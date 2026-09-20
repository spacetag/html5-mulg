// The rules of the game, with no DOM in sight, so they can be played out in a
// test as well as in a browser. index.js wires this up to the page.

var collisionChecker = require('./collision-checking')
var tiles = require('./tiles')

var TILE_SIZE = 32
var FPS_MULTIPLIER = 3 // based on 20fps
var OFFSET_X = 14
var OFFSET_Y = 14

var BALL_SPEED_THRESH = 0.1
// Floor pushes the ball towards a speed of 99 and never past it, so this caps
// the frictionless surfaces without changing how floor has always felt.
var BALL_MAX_SPEED = 99

// mulg.c works in 16ths of a tile, and every rule below is written in those
// units, so this is one of them in the sizes this port draws at.
var SUB_TILE = 16
var SUB_STEP = TILE_SIZE / SUB_TILE
// mulg.c's DUSCH: a hit on a wall costs the marble 30% of the speed it hit at.
var BOUNCE_KEEP = 0.7

var REGISTER_KEYPRESSES_EVERY_MS = 50
// How long a gate rests on each frame as it slides open or shut. mulg.c steps a
// door on every fourth animation tick, and a tick is the 40 ms its own clock
// counts per frame (`level_time += 40`), so a gate is about half a second between
// fully open and fully shut. It used to be a third of that, which left no time at
// all to get through one.
var GATE_FRAME_MS = 160
var LIVES_PER_GAME = 3

var OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' }

// Which of the four diagonally neighbouring squares the marble is far enough
// into to touch, for each of the 16x16 positions it can sit at inside a square.
// This is mulg.c's `hole` table (hole.c) as it stands, indexed [iy][ix]: the top
// five bits are what the collision check reads, and the bottom three are the
// hole and hump acceleration this port does not have yet, left in so they are
// here when it does. Rolling the marble's round shape into a table is how the
// original gets a circle's worth of accuracy out of integer arithmetic.
var CORNER_UP_LEFT = 0x80
var CORNER_DOWN_LEFT = 0x40
var CORNER_DOWN_RIGHT = 0x20
var CORNER_UP_RIGHT = 0x10
// Set on the positions where the marble is only just touching, so a tile that
// cares which way it was entered is told.
var CORNER_ENTERING = 0x08
var CORNERS = 0xf0 | CORNER_ENTERING

var CORNER_MASK = [
    [0x80,0x80,0x80,0x80,0x88,0x00,0x00,0x00,0x00,0x00,0x18,0x10,0x10,0x10,0x10,0x10],
    [0x80,0x80,0x80,0x88,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x18,0x10,0x10,0x10,0x10],
    [0x80,0x80,0x80,0x88,0x00,0x00,0x04,0x04,0x04,0x00,0x00,0x18,0x10,0x10,0x10,0x10],
    [0x80,0x88,0x88,0x00,0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x00,0x18,0x18,0x10,0x10],
    [0x88,0x00,0x00,0x02,0x02,0x02,0x02,0x02,0x02,0x02,0x02,0x02,0x00,0x00,0x18,0x18],
    [0x00,0x00,0x00,0x01,0x01,0x01,0x01,0x01,0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00],
    [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
    [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
    [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
    [0x00,0x00,0x00,0x01,0x01,0x01,0x01,0x01,0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00],
    [0x48,0x00,0x00,0x02,0x02,0x02,0x02,0x02,0x02,0x02,0x02,0x02,0x00,0x00,0x28,0x28],
    [0x40,0x48,0x48,0x00,0x03,0x03,0x03,0x03,0x03,0x03,0x03,0x00,0x28,0x28,0x20,0x20],
    [0x40,0x40,0x40,0x48,0x00,0x00,0x04,0x04,0x04,0x00,0x00,0x28,0x20,0x20,0x20,0x20],
    [0x40,0x40,0x40,0x48,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x28,0x20,0x20,0x20,0x20],
    [0x40,0x40,0x40,0x40,0x48,0x00,0x00,0x00,0x00,0x00,0x28,0x20,0x20,0x20,0x20,0x20],
    [0x40,0x40,0x40,0x40,0x48,0x00,0x00,0x00,0x00,0x00,0x28,0x20,0x20,0x20,0x20,0x20]
]

// The ways the marble can be rolling into a square, as mulg.c's eight entering
// directions. Null stands for its ninth case: the marble is already overlapping
// the square without having rolled into it.
var HEADING_LEFT = { x: -1, y: 0 }
var HEADING_RIGHT = { x: 1, y: 0 }
var HEADING_UP = { x: 0, y: -1 }
var HEADING_DOWN = { x: 0, y: 1 }
var HEADING_UP_LEFT = { x: -1, y: -1 }
var HEADING_UP_RIGHT = { x: 1, y: -1 }
var HEADING_DOWN_LEFT = { x: -1, y: 1 }
var HEADING_DOWN_RIGHT = { x: 1, y: 1 }

var PLAYING = 'playing'
var DEAD = 'dead'
var LEVEL_WON = 'level-won'
var GAME_OVER = 'game-over'
var GAME_WON = 'game-won'

function copyGrid(rows) {
    return rows.map(function(row) {
        return row.slice()
    })
}

module.exports = function createGame(levels, options) {
    options = options || {}

    var livesPerGame = options.lives === undefined ? LIVES_PER_GAME : options.lives

    var game = {
        levels: levels,
        levelIndex: 0,
        level: null,
        grid: null,
        status: PLAYING,
        score: 0,
        lives: livesPerGame,
        elapsedMs: 0,
        ball: { x: 0, y: 0, sx: 0, sy: 0 },
        ghost: false,
        input: { left: false, right: false, up: false, down: false }
    }

    var checkForCollision = null
    var tileChanges = []
    // The original wires activators to activated tiles through 32 channels.
    var channels = []
    var wiring = {}
    var activatedCells = []
    var switchCells = []
    var standingOn = null
    // The solid squares the ball was up against last tick and this one, so a
    // switch is thrown as the ball arrives at it rather than over and over while
    // it stays leaning on it.
    var leaningOn = {}
    var leaningOnNow = {}
    var notes = {}
    // The secret pass-through key. Undocumented on purpose, so it is off until
    // something asks for it.
    var ghost = false
    var sinceLastMomentumTick = 0
    // The score as it stood when this level started. Restarting a level puts the
    // coins back, so it has to put the score back too.
    var scoreAtLevelStart = 0

    /***** Where the ball is *****/

    // The original worked in 16ths of a tile, and the bounce rules below are
    // written in those units, so keep the conversion.
    function ballRow() { return (game.ball.y + OFFSET_Y) / TILE_SIZE }
    function ballCol() { return (game.ball.x + OFFSET_X) / TILE_SIZE }
    function ballIX() { return (game.ball.x + OFFSET_X) % TILE_SIZE * 16 / TILE_SIZE }
    function ballIY() { return (game.ball.y + OFFSET_Y) % TILE_SIZE * 16 / TILE_SIZE }

    function wrapped(row, col) {
        var height = game.grid.length
        var width = game.grid[0].length
        return {
            row: Math.floor((row + height) % height),
            col: Math.floor((col + width) % width)
        }
    }

    // Nothing can roll off the board in normal play, but passing through walls
    // can, and the board already wraps for the squares. Keep the marble's own
    // position on it too, so what is drawn is the square it is really on.
    function wrapCoord(value, offset, size) {
        return ((value + offset) % size + size) % size - offset
    }

    function ballSquare() {
        var at = wrapped(ballRow(), ballCol())
        at.tile = game.grid[at.row][at.col]
        return at
    }

    // A square stops the ball if it is a wall, or if it is a one-way arrow the
    // ball is trying to enter against. `entering` is the way the ball is rolling
    // in, or null when it is already overlapping the square, which is the case
    // mulg.c's check_tile calls dir 0.
    function blocks(tileNumber, entering) {
        if (ghost) return false

        // The ball is inside a gate it never rolled into, so the gate came down on
        // top of it. mulg.c ends the level right here.
        if (tiles.isClosedGate(tileNumber)) {
            if (!entering) killedBy('The gate closed on you.')
            return true
        }

        // A death cube kills the ball that touches it and is solid besides, so in
        // the original the ball never gets onto its square at all. It is the only
        // square that kills from next door: an open pit only takes the ball that
        // is over it.
        if (tileNumber === tiles.TILE.DEATH_CUBE) {
            killedBy('You touched a death cube.')
            return true
        }

        if (tiles.isWall(tileNumber)) return true

        var oneWay = tiles.oneWayDirection(tileNumber)

        // A one-way only turns the ball away as it rolls in, and only when it is
        // rolling against the arrow. Once the ball is on it, it is free to leave.
        if (oneWay === null || !entering) return false

        if (oneWay === 'left') return entering.x > 0
        if (oneWay === 'right') return entering.x < 0
        if (oneWay === 'up') return entering.y > 0
        return entering.y < 0
    }

    /***** Channels *****/

    function setTile(row, col, tileNumber) {
        game.grid[row][col] = tileNumber
        tileChanges.push({ row: row, col: col, tile: tileNumber })
    }

    function noteAt(row, col) {
        return notes[row + ',' + col] || null
    }

    function readNotes(level) {
        notes = {};

        (level.notes || []).forEach(function(note) {
            notes[note.row + ',' + note.col] = note.text
        })
    }

    function wireUp(level) {
        channels = []
        for (var i = 0; i < tiles.CHANNELS; i++) channels.push(false)

        wiring = {}
        activatedCells = []
        switchCells = [];

        (level.wiring || []).forEach(function(wire) {
            wiring[wire.row + ',' + wire.col] = wire.channel

            var tile = game.grid[wire.row][wire.col]
            var forms = tiles.switchForms(tile)

            if (forms) {
                switchCells.push({ row: wire.row, col: wire.col, channel: wire.channel, forms: forms })
                return
            }

            var partner = tiles.activatedPartner(tile)

            if (partner !== null) {
                var frames = tiles.frameSequence(tile)

                activatedCells.push({
                    row: wire.row,
                    col: wire.col,
                    channel: wire.channel,
                    base: tile,
                    partner: partner,
                    frames: frames,
                    frame: frames ? frames.indexOf(tile) : 0,
                    target: frames ? frames.indexOf(tile) : 0,
                    sinceFrame: 0
                })
            }
        })
    }

    function setChannel(channel, on) {
        if (channels[channel] === on) return

        channels[channel] = on

        activatedCells.forEach(function(cell) {
            if (cell.channel !== channel) return

            var wanted = on ? cell.partner : cell.base

            // A gate slides: it is given a frame to head for, and gets there over
            // the next few ticks. Everything else changes on the spot.
            if (cell.frames) {
                cell.target = cell.frames.indexOf(wanted)
                cell.sinceFrame = 0
                return
            }

            setTile(cell.row, cell.col, wanted)
        })

        switchCells.forEach(function(cell) {
            if (cell.channel === channel) setTile(cell.row, cell.col, on ? cell.forms.on : cell.forms.off)
        })
    }

    function advanceGates(elapsedMs) {
        activatedCells.forEach(function(cell) {
            if (!cell.frames || cell.frame === cell.target) return

            cell.sinceFrame += elapsedMs

            while (cell.sinceFrame >= GATE_FRAME_MS && cell.frame !== cell.target) {
                cell.sinceFrame -= GATE_FRAME_MS
                cell.frame += cell.frame < cell.target ? 1 : -1
                setTile(cell.row, cell.col, cell.frames[cell.frame])
            }
        })
    }

    function channelAt(row, col) {
        var channel = wiring[row + ',' + col]
        return channel === undefined ? null : channel
    }

    // The ball bumped into a square. A switch it cannot roll over is thrown this
    // way.
    function throwSwitchAt(row, col) {
        var channel = channelAt(row, col)
        if (channel === null) return

        var forms = tiles.switchForms(game.grid[row][col])
        if (forms && !forms.momentary) setChannel(channel, !channels[channel])
    }

    // A floor switch is held down only while the ball is on it.
    function pressSquare(at) {
        var channel = channelAt(at.row, at.col)
        if (channel === null) return

        var forms = tiles.switchForms(game.grid[at.row][at.col])
        if (forms && forms.momentary) setChannel(channel, true)
    }

    function releaseSquare(at) {
        var channel = channelAt(at.row, at.col)
        if (channel === null) return

        var forms = tiles.switchForms(game.grid[at.row][at.col])
        if (forms && forms.momentary) setChannel(channel, false)
    }

    /***** Loading and restarting *****/

    function loadLevel(index, keepScore) {
        game.levelIndex = index
        game.level = levels[index]
        // Coins vanish as they are collected, so play on a copy of the level.
        game.grid = copyGrid(game.level.tiles)
        checkForCollision = collisionChecker(game.grid, blocks)
        readNotes(game.level)
        wireUp(game.level)
        standingOn = null
        leaningOn = {}
        leaningOnNow = {}
        game.notes = []
        game.lastNote = null

        game.score = keepScore ? scoreAtLevelStart : 0
        scoreAtLevelStart = game.score
        game.elapsedMs = 0
        game.status = PLAYING
        game.message = ''
        game.ball.x = game.level.start.col * TILE_SIZE
        game.ball.y = game.level.start.row * TILE_SIZE
        game.ball.sx = 0
        game.ball.sy = 0
        sinceLastMomentumTick = 0
        tileChanges = []
    }

    function startNewGame() {
        game.lives = livesPerGame
        loadLevel(0, false)
    }

    // The one key that moves the game on: the next level when you have just won
    // one, a fresh game when it is over, otherwise another go at this level.
    function advance() {
        if (game.status === LEVEL_WON) loadLevel(game.levelIndex + 1, true)
        else if (game.status === GAME_OVER || game.status === GAME_WON) startNewGame()
        else loadLevel(game.levelIndex, true)
    }

    // Jump straight to a level, which is what the level selector does. The score
    // banked so far carries over, and so do the lives, except that a game which
    // has already run out of them gets a fresh set to play the level with.
    function goToLevel(index) {
        if (index < 0 || index >= levels.length) return
        if (game.lives <= 0) game.lives = livesPerGame
        loadLevel(index, true)
    }

    /***** Movement *****/

    // The ball has come up against a solid square. mulg.c throws a switch as the
    // ball arrives at it, and the ball looks at what it is touching after every
    // sixteenth of a square it moves, so without this a single shove would ask a
    // switch a dozen times over and a toggle asked twice is a toggle that did
    // nothing. It is thrown on arrival, and not again until the ball has come off
    // it.
    function bumped(row, col) {
        var at = wrapped(row, col)
        var key = at.row + ',' + at.col
        var arriving = !leaningOn[key] && !leaningOnNow[key]

        leaningOnNow[key] = true

        if (arriving) throwSwitchAt(at.row, at.col)
    }

    function clamp(speed) {
        if (speed > BALL_MAX_SPEED) return BALL_MAX_SPEED
        if (speed < -BALL_MAX_SPEED) return -BALL_MAX_SPEED
        return speed
    }

    // Is the ball touching something solid where it stands? This is mulg.c's
    // check_marble: the ball is a circle a little smaller than its square, so it
    // reaches into the next square along once it is more than nine sixteenths of
    // the way over, and into a diagonal neighbour on the positions the corner
    // table marks. A hit costs the ball speed on the axis it hit on, the way
    // DUSCH does in the original, so bouncing around a room winds down.
    function touchingSomething() {
        var ball = game.ball
        var row = ballRow()
        var col = ballCol()
        var ix = Math.floor(ballIX())
        var iy = Math.floor(ballIY())

        // ... horizontally ...
        if (ix > 9 && blocking(row, col + 1, ix === 10 && ball.sx > 0 ? HEADING_RIGHT : null)) {
            ball.sx = ball.sx * BOUNCE_KEEP
            return true
        }

        if (ix < 5 && blocking(row, col - 1, ix === 4 && ball.sx < 0 ? HEADING_LEFT : null)) {
            ball.sx = ball.sx * BOUNCE_KEEP
            return true
        }

        // ... vertically ...
        if (iy > 9 && blocking(row + 1, col, iy === 10 && ball.sy > 0 ? HEADING_DOWN : null)) {
            ball.sy = ball.sy * BOUNCE_KEEP
            return true
        }

        if (iy < 5 && blocking(row - 1, col, iy === 4 && ball.sy < 0 ? HEADING_UP : null)) {
            ball.sy = ball.sy * BOUNCE_KEEP
            return true
        }

        // ... and diagonally, off the corner of a wall.
        var corners = CORNER_MASK[iy][ix] & CORNERS
        if (!corners) return false

        var arriving = (corners & CORNER_ENTERING) !== 0

        if (((corners & CORNER_UP_LEFT) && blocking(row - 1, col - 1, arriving ? HEADING_UP_LEFT : null)) ||
            ((corners & CORNER_DOWN_LEFT) && blocking(row + 1, col - 1, arriving ? HEADING_DOWN_LEFT : null)) ||
            ((corners & CORNER_UP_RIGHT) && blocking(row - 1, col + 1, arriving ? HEADING_UP_RIGHT : null)) ||
            ((corners & CORNER_DOWN_RIGHT) && blocking(row + 1, col + 1, arriving ? HEADING_DOWN_RIGHT : null))) {
            ball.sx = ball.sx * BOUNCE_KEEP
            ball.sy = ball.sy * BOUNCE_KEEP
            return true
        }

        return false
    }

    // Asking whether a square is solid is also how the ball bumps a switch on it,
    // which is what mulg.c's check_tile does in the same breath.
    function blocking(row, col, entering) {
        if (!checkForCollision(row, col, entering)) return false

        bumped(row, col)
        return true
    }

    function sign(value) {
        if (value > 0) return 1
        if (value < 0) return -1
        return 0
    }

    function shiftX(by) {
        game.ball.x = wrapCoord(game.ball.x + by, OFFSET_X, game.grid[0].length * TILE_SIZE)
    }

    function shiftY(by) {
        game.ball.y = wrapCoord(game.ball.y + by, OFFSET_Y, game.grid.length * TILE_SIZE)
    }

    // mulg.c never moves the marble far without looking. It walks the travel a
    // sixteenth of a square at a time along whichever axis is the faster, looks
    // after each step, and takes a step back the moment the ball has ended up
    // inside something. That is the whole difference between a ball that turns
    // away the instant it touches a wall and one that jumps a tile per frame and
    // sails straight through: it cannot outrun a check that happens every step.
    function moveBall(dx, dy) {
        var ball = game.ball
        var goneX = 0
        var goneY = 0
        var stepX, stepY, steps

        if (Math.abs(dx) >= SUB_STEP || Math.abs(dy) >= SUB_STEP) {
            if (Math.abs(dx) >= Math.abs(dy)) {
                // Step along x, and let y come along in proportion.
                stepY = SUB_STEP * dy / Math.abs(dx)
                stepX = dx > 0 ? SUB_STEP : -SUB_STEP
                steps = Math.floor(Math.abs(dx) / SUB_STEP)
            } else {
                stepX = SUB_STEP * dx / Math.abs(dy)
                stepY = dy > 0 ? SUB_STEP : -SUB_STEP
                steps = Math.floor(Math.abs(dy) / SUB_STEP)
            }

            for (; steps > 0; steps--) {
                goneY += Math.abs(stepY)
                shiftY(stepY)

                if (touchingSomething()) {
                    stepY = -stepY
                    ball.sy = -ball.sy
                    shiftY(2 * stepY)
                }

                goneX += Math.abs(stepX)
                shiftX(stepX)

                if (touchingSomething()) {
                    stepX = -stepX
                    ball.sx = -ball.sx
                    shiftX(2 * stepX)
                }

                // A gate can come down on the ball part-way through a step.
                if (game.status !== PLAYING) return
            }
        }

        // Then whatever is left over, which is less than a step's worth. The sign
        // is the direction the ball is travelling by now, which a bounce above may
        // have turned around.
        if (goneX < Math.abs(dx)) {
            stepX = (Math.abs(dx) - goneX) * sign(ball.sx)
            shiftX(stepX)

            if (touchingSomething()) {
                ball.sx = -ball.sx
                shiftX(-2 * stepX)
            }
        }

        if (goneY < Math.abs(dy) && game.status === PLAYING) {
            stepY = (Math.abs(dy) - goneY) * sign(ball.sy)
            shiftY(stepY)

            if (touchingSomething()) {
                ball.sy = -ball.sy
                shiftY(-2 * stepY)
            }
        }
    }

    function updateBallPos(updateMomentum) {
        var ball = game.ball
        var surface = tiles.surface(ballSquare().tile)

        if (updateMomentum) {
            var extrax = ((game.input.right ? 1 : 0) - (game.input.left ? 1 : 0)) * surface.control
            var extray = ((game.input.down ? 1 : 0) - (game.input.up ? 1 : 0)) * surface.control
            ball.sx = clamp((ball.sx + extrax) * (extrax ? surface.decayOn : surface.decayOff))
            ball.sy = clamp((ball.sy + extray) * (extray ? surface.decayOn : surface.decayOff))
        }

        // A one-way arrow turns the ball away as it rolls in, which `blocks` above
        // does. The ball standing on one used to have the speed it was pushing
        // against taken off it as well, and mulg.c does no such thing: it leaves
        // the ball free to shuffle about on the arrow, which is what it needs to
        // do to line itself up with the gap it is heading for.

        // http://www.w3schools.com/jsref/jsref_abs.asp
        if (Math.abs(ball.sx) < BALL_SPEED_THRESH) ball.sx = 0
        if (Math.abs(ball.sy) < BALL_SPEED_THRESH) ball.sy = 0

        moveBall(ball.sx / FPS_MULTIPLIER, ball.sy / FPS_MULTIPLIER)
    }

    /***** What the ball is standing on *****/

    function stop() {
        game.ball.sx = 0
        game.ball.sy = 0
    }

    function die(what) {
        game.lives = game.lives - 1
        stop()

        if (game.lives > 0) {
            game.status = DEAD
            game.message = (what || 'Ouch.') + ' Press R to try again, ' + game.lives + ' left.'
        } else {
            game.status = GAME_OVER
            game.message = (what || 'Ouch.') + ' Game over, press R to start again.'
        }
    }

    // Something the ball has run into is fatal rather than merely solid. It costs
    // a life like any other way of dying, and it can happen in the middle of a
    // step, so it only counts once.
    function killedBy(what) {
        if (game.status !== PLAYING) return
        die(what)
    }

    function winLevel() {
        stop()
        // The coins picked up on the way are banked now, so they survive into
        // the next level.
        scoreAtLevelStart = game.score

        if (game.levelIndex + 1 < levels.length) {
            game.status = LEVEL_WON
            game.message = 'Level complete. Press R for the next one.'
        } else {
            game.status = GAME_WON
            game.message = 'All levels complete, ' + game.score + ' points. Press R to play again.'
        }
    }

    function checkWhatBallIsOn() {
        var here = ballSquare()

        if (!standingOn || standingOn.row !== here.row || standingOn.col !== here.col) {
            if (standingOn) releaseSquare(standingOn)
            standingOn = { row: here.row, col: here.col }
            pressSquare(standingOn)
            here = ballSquare()
        }

        if (tiles.isLetter(here.tile)) {
            var text = noteAt(here.row, here.col)
            game.grid[here.row][here.col] = tiles.TILE.FLOOR
            tileChanges.push({ row: here.row, col: here.col, tile: tiles.TILE.FLOOR })

            if (text) {
                game.notes.push(text)
                game.lastNote = text
            }
        } else if (tiles.isCoin(here.tile)) {
            game.score = game.score + tiles.coinValue(here.tile)
            game.grid[here.row][here.col] = tiles.TILE.FLOOR
            tileChanges.push({ row: here.row, col: here.col, tile: tiles.TILE.FLOOR })
        } else if (tiles.isClosedGate(here.tile)) {
            // mulg.c: "standing in closing door -> end of game".
            killedBy('The gate closed on you.')
        } else if (tiles.isDeadly(here.tile)) {
            die()
        } else if (tiles.isGoal(here.tile)) {
            winLevel()
        }
    }

    /***** The tick *****/

    function tick(elapsedMsSinceLastTick) {
        // Won, dead or game over: nothing moves until the player presses on.
        if (game.status !== PLAYING) return

        game.elapsedMs += elapsedMsSinceLastTick

        sinceLastMomentumTick += elapsedMsSinceLastTick
        var updateMomentum = false

        if (sinceLastMomentumTick > REGISTER_KEYPRESSES_EVERY_MS) {
            sinceLastMomentumTick = sinceLastMomentumTick - REGISTER_KEYPRESSES_EVERY_MS
            updateMomentum = true
        }

        advanceGates(elapsedMsSinceLastTick)

        leaningOnNow = {}
        updateBallPos(updateMomentum)
        leaningOn = leaningOnNow

        checkWhatBallIsOn()
    }

    // Tiles that changed since the renderer last asked, so it can repaint just
    // those squares.
    function consumeTileChanges() {
        var changes = tileChanges
        tileChanges = []
        return changes
    }

    game.tick = tick
    game.advance = advance
    game.goToLevel = goToLevel

    game.setGhost = function(on) {
        ghost = !!on
        game.ghost = ghost
        return ghost
    }

    game.toggleGhost = function() { return game.setGhost(!ghost) }

    game.startNewGame = startNewGame
    game.consumeTileChanges = consumeTileChanges
    game.ballSquare = ballSquare
    game.noteAt = noteAt
    game.channelOn = function(channel) { return channels[channel] }

    startNewGame()

    return game
}

module.exports.TILE_SIZE = TILE_SIZE
module.exports.FPS_MULTIPLIER = FPS_MULTIPLIER
module.exports.PLAYING = PLAYING
module.exports.DEAD = DEAD
module.exports.LEVEL_WON = LEVEL_WON
module.exports.GAME_OVER = GAME_OVER
module.exports.GAME_WON = GAME_WON
