(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
var DEFAULT_COLLISION_TILES = [ 6 ]

// `blocks` is either a list of tile numbers that stop the marble, or a predicate
// taking a tile number. Left out, it falls back to the green block, which is the
// only wall this game knew about originally.
module.exports = function makeCollisionCheckingFunction(level, blocks) {
    var levelHeight = level.length
    var levelWidth = level[0].length

    if (blocks === undefined) blocks = DEFAULT_COLLISION_TILES

    var blocksTile = typeof blocks === 'function' ? blocks : function(tileNumber) {
        return blocks.indexOf(tileNumber) !== -1
    }

    // `entering` is which way the ball is heading into the square, as a pair of
    // -1/0/1 components, for tiles like the one-way arrows that only block from
    // one side. It is null when the ball is already overlapping the square rather
    // than rolling into it, which mulg.c distinguishes and some tiles care about.
    // A list of tile numbers ignores it.
    return function checkForCollision(row, col, entering) {
        // http://stackoverflow.com/questions/4228356/integer-division-in-javascript
        row = Math.floor((row + levelHeight) % levelHeight)
        col = Math.floor((col + levelWidth)  % levelWidth)

        return blocksTile(level[row][col], entering)
    }
}

},{}],2:[function(require,module,exports){
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
// door on every fourth game frame, and a game frame there is what this port calls
// REGISTER_KEYPRESSES_EVERY_MS, so a gate is a little over half a second between
// fully open and fully shut. It used to be a quarter of that, which left no time
// at all to get through one.
var GATE_FRAME_MS = 4 * REGISTER_KEYPRESSES_EVERY_MS
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
            if (!entering) crushed()
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

    // A gate came down on the ball. It costs a life like any other way of dying,
    // and it can happen in the middle of a step, so it only counts once.
    function crushed() {
        if (game.status !== PLAYING) return
        die('Squashed by a gate.')
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
            crushed()
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

},{"./collision-checking":1,"./tiles":15}],3:[function(require,module,exports){
// Wiring: keyboard in, board and HUD out. The rules live in game.js.

var frameLoop = require('frame-loop')
var createBoard = require('./render')
var createGame = require('./game')
var levels = require('./levels')

var TILE_SIZE = createGame.TILE_SIZE
var FPS_MULTIPLIER = createGame.FPS_MULTIPLIER

// http://stackoverflow.com/questions/5597060/detecting-arrow-key-presses-in-javascript
var KEY_TO_DIRECTION = {
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down'
}
var RESTART_KEY = 82 // r
// Not in the help line, and not a button: the marble going see-through is the
// only sign this key is here.
var GHOST_KEY = 87 // w

// What the speed button steps through. A step runs the whole simulation one
// more time per frame, so at 2x the marble, the switches and the clock all move
// at twice the rate and the game plays exactly as it does at 1x, only quicker.
var SPEEDS = [ 1, 2 ]
var speedIndex = 0

var game = createGame(levels)
var board = createBoard(document.getElementById("board"), TILE_SIZE)

var levelSelect = document.getElementById("level_select")
var speedButton = document.getElementById("speed_button")

var hud = {
    level: document.getElementById("hud_level"),
    time: document.getElementById("hud_time"),
    score: document.getElementById("hud_score"),
    lives: document.getElementById("hud_lives"),
    message: document.getElementById("message")
}

var notesUi = {
    note: document.getElementById("note"),
    toggle: document.getElementById("notes_toggle"),
    list: document.getElementById("notes_list")
}

// Rebuilt only when a note is picked up, not every frame.
var notesShown = -1

notesUi.toggle.onclick = function() {
    var open = notesUi.list.style.display === "block"
    notesUi.list.style.display = open ? "none" : "block"
    // The panel above holds the newest note, so hide it while the full list is
    // up rather than printing that note twice.
    notesUi.note.style.display = open && game.lastNote ? "block" : "none"
    notesUi.toggle.blur()
}

function formatTime(ms) {
    var totalSeconds = Math.floor(ms / 1000)
    var minutes = Math.floor(totalSeconds / 60)
    var seconds = totalSeconds % 60
    return minutes + ":" + ("0" + seconds).slice(-2)
}

function drawLevel() {
    board.draw(game.grid)
    board.setBallGhost(game.ghost)
    hud.level.textContent = (game.levelIndex + 1) + "/" + levels.length + " " + game.level.name
    notesShown = -1
    notesUi.list.style.display = "none"
    // The level also moves on by being played, so the selector follows the game
    // rather than the other way round.
    levelSelect.value = String(game.levelIndex)
}

// The newest note is shown as it is picked up; the button brings back the ones
// already read.
function drawNotes() {
    if (game.notes.length === notesShown) return
    notesShown = game.notes.length

    notesUi.note.textContent = game.lastNote || ""
    notesUi.note.style.display = game.lastNote && notesUi.list.style.display !== "block" ? "block" : "none"

    notesUi.toggle.textContent = "Notes (" + game.notes.length + ")"
    notesUi.toggle.style.display = game.notes.length ? "inline-block" : "none"

    notesUi.list.innerHTML = ""

    game.notes.forEach(function(text) {
        var item = document.createElement("li")
        item.textContent = text
        notesUi.list.appendChild(item)
    })
}

function drawHud() {
    hud.time.textContent = formatTime(game.elapsedMs)
    hud.score.textContent = game.score
    hud.lives.textContent = game.lives
    hud.message.textContent = game.message
    hud.message.style.visibility = game.message ? "visible" : "hidden"
}

/***** Controls *****/

// Every level is listed, not just the ones reached: this is a port to poke at,
// and hunting for a level behind fourteen others is no fun.
levels.forEach(function(level, index) {
    var option = document.createElement("option")
    option.value = String(index)
    option.textContent = (index + 1) + ". " + level.name
    levelSelect.appendChild(option)
})

levelSelect.onchange = function() {
    game.goToLevel(Number(levelSelect.value))
    drawLevel()
    drawHud()
    board.setBallPos(game.ball.x, game.ball.y)
    // Otherwise the arrow keys would go on steering the list instead of the
    // marble.
    levelSelect.blur()
}

function drawSpeed() {
    speedButton.textContent = "Speed " + SPEEDS[speedIndex] + "\u00d7"
}

speedButton.onclick = function() {
    speedIndex = (speedIndex + 1) % SPEEDS.length
    drawSpeed()
    speedButton.blur()
}

/***** Input *****/
// http://stackoverflow.com/questions/5203407/javascript-multiple-keys-pressed-at-once

document.onkeydown = function(e) {
    e = e || window.event
    var direction = KEY_TO_DIRECTION[e.keyCode]

    if (direction) {
        game.input[direction] = true
        e.preventDefault()
    }
}

document.onkeyup = function(e) {
    e = e || window.event
    var direction = KEY_TO_DIRECTION[e.keyCode]

    if (direction) game.input[direction] = false

    if (e.keyCode === RESTART_KEY) {
        game.advance()
        drawLevel()
        drawHud()
    }

    if (e.keyCode === GHOST_KEY) board.setBallGhost(game.toggleGhost())
}

/***** Main Game Loop *****/

function main(elapsedMsSinceLastTick) {
    for (var step = 0; step < SPEEDS[speedIndex]; step++) game.tick(elapsedMsSinceLastTick)

    game.consumeTileChanges().forEach(function(change) {
        board.setTile(change.row, change.col, change.tile)
    })

    board.setBallPos(game.ball.x, game.ball.y)
    drawHud()
    drawNotes()
}

drawSpeed()
drawLevel()
drawHud()
drawNotes()
board.setBallPos(game.ball.x, game.ball.y)

var engine = frameLoop({
    fps: 20 * FPS_MULTIPLIER
}, main)

engine.run()

},{"./game":2,"./levels":4,"./render":14,"frame-loop":7}],4:[function(require,module,exports){
// Level data, kept as data rather than as a literal inside the game loop.
//
// A level is:
//   name  - shown in the HUD
//   start - { row, col } the marble's starting square
//   tiles - a grid of tile numbers from tiles/ (docs/original-tiles.md says what
//           each number is in the original game)
//   wiring - optional, [ { row, col, channel } ]. The original wires activators
//           (switches) to activated tiles (gates, pits) through 32 channels,
//           carried in a data byte beside each tile; this is the same idea,
//           listed only for the squares that have one.
//
// Every row of a level must be the same length. Levels may differ in size from
// each other; the board is rendered from the grid. The original allowed levels
// up to 37x33, larger than one screen; these all fit on one for now.
//
// They are in the order they are meant to be played. Each one leans on what the
// last one taught and adds at most one new idea, and none of them uses anything
// the port has not implemented yet - an unhandled tile would be scenery, and a
// puzzle built on scenery is not a puzzle.

var tiles = require('./tiles')

var F = tiles.TILE.FLOOR
var W = tiles.TILE.BLOCK
var G = tiles.TILE.TARGET_CROSS
var C = tiles.TILE.COIN_1
var V = tiles.TILE.COIN_5
var X = tiles.TILE.DEATH_CUBE
var P = tiles.TILE.EMPTY_PIT
var I = tiles.TILE.ICY_FLOOR
var M = tiles.TILE.MUD
var D = tiles.TILE.ONE_WAY_DOWN
var S = tiles.TILE.SWITCH_LOW
var H = tiles.TILE.HGATE_CLOSED
var N = tiles.TILE.VGATE_CLOSED
var B = tiles.TILE.FLOOR_SWITCH_UP
var O = tiles.TILE.OIL
var U = tiles.TILE.ONE_WAY_UP
var L = tiles.TILE.ONE_WAY_LEFT
var R = tiles.TILE.ONE_WAY_RIGHT
// A floor square wired to a channel is a trapdoor: it drops away into a pit
// when the channel comes on, the same way a wired pit fills in.
var T = tiles.TILE.FLOOR

module.exports = [
    {
        name: 'First Roll',
        start: { row: 7, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, F, F, C, W ],
            [ W, F, W, W, W, W, W, F, W, W ],
            [ W, F, W, F, F, F, W, F, C, W ],
            [ W, F, F, F, W, F, W, W, F, W ],
            [ W, W, W, W, W, F, F, W, F, W ],
            [ W, C, F, F, W, W, F, W, F, W ],
            [ W, F, W, F, F, F, F, W, G, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ]
    },
    {
        name: 'Detour',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, W, C, F, F, F, W ],
            [ W, F, W, F, W, F, W, W, F, W ],
            [ W, F, W, F, F, F, W, V, F, W ],
            [ W, F, W, W, W, W, W, W, F, W ],
            [ W, F, F, C, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, F, W ],
            [ W, G, F, F, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ]
    },
    {
        name: 'Mind the Death Cubes',
        start: { row: 1, col: 8 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, G, F, F, X, F, F, F, F, W ],
            [ W, W, W, F, W, W, W, W, F, W ],
            [ W, V, F, F, F, F, C, W, F, W ],
            [ W, W, W, W, X, W, F, W, F, W ],
            [ W, C, F, F, F, F, F, F, F, W ],
            [ W, F, W, W, F, W, W, W, X, W ],
            [ W, F, F, W, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ]
    },
    {
        name: 'Slippery',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, I, I, I, I, I, I, C, W ],
            [ W, W, W, W, W, W, W, W, D, W ],
            [ W, C, M, M, F, F, F, F, F, W ],
            [ W, F, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, P, F, F, F, F, W ],
            [ W, S, W, W, W, W, W, W, F, W ],
            [ W, G, F, F, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 6, col: 1, channel: 0 },   // the switch under the corridor
            { row: 5, col: 4, channel: 0 }    // the pit it fills in
        ]
    },
    {
        name: 'Locked In',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, F, F, S, W ],
            [ W, F, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, C, F, F, W ],
            [ W, W, W, W, W, W, W, W, H, W ],
            [ W, C, F, F, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, F, W ],
            [ W, F, F, F, F, F, F, F, G, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 1, col: 8, channel: 0 },   // the switch
            { row: 4, col: 8, channel: 0 }    // the gate it opens
        ]
    },
    {
        name: 'Oil Slick',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, F, F, C, W ],
            [ W, F, W, W, W, W, W, W, F, W ],
            [ W, F, F, O, O, O, O, F, F, W ],
            [ W, M, W, O, C, O, O, W, W, W ],
            [ W, F, W, O, O, O, O, F, F, W ],
            [ W, F, W, W, W, W, W, W, M, W ],
            [ W, C, F, F, F, F, W, G, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ]
    },
    {
        name: 'Step on It',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, F, N, C, W ],
            [ W, F, W, W, S, W, S, W, F, W ],
            [ W, C, F, F, F, W, F, F, F, W ],
            [ W, W, W, W, H, W, F, W, W, W ],
            [ W, F, F, F, F, F, F, W, V, W ],
            [ W, W, F, W, W, W, W, W, F, W ],
            [ W, G, F, F, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        // Both gates used to be held open by a floor plate in the square next to
        // them, which a gate that kills makes deadly: rolling off the plate is
        // what starts the gate closing, and the square it closes on is the one the
        // ball has just rolled into. These are switches set into the wall instead,
        // so a gate stays open once it is opened, and each of them can be reached
        // from either side of its gate.
        wiring: [
            { row: 2, col: 6, channel: 0 },   // the switch in the top corridor's floor
            { row: 1, col: 7, channel: 0 },   // and the gate it opens
            { row: 2, col: 4, channel: 1 },   // the switch at the dead end
            { row: 4, col: 4, channel: 1 }    // and the shortcut it opens
        ]
    },
    {
        name: 'One Way Out',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, R, R, R, R, R, R, C, W ],
            [ W, U, W, W, W, W, W, W, D, W ],
            [ W, U, W, W, G, W, W, W, D, W ],
            [ W, U, W, W, F, W, W, W, D, W ],
            [ W, U, W, W, C, W, W, W, D, W ],
            [ W, U, W, W, F, W, W, W, D, W ],
            [ W, V, L, L, L, L, L, C, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ]
    },
    {
        name: 'Double Act',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, C, F, F, W ],
            [ W, W, W, W, W, S, W, W, F, W ],
            [ W, C, F, F, N, F, F, F, F, W ],
            [ W, F, V, W, W, W, W, W, W, W ],
            [ W, F, F, F, I, I, I, F, X, W ],
            [ W, W, W, W, W, S, W, F, W, W ],
            [ W, G, F, F, N, F, F, F, W, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 2, col: 5, channel: 0 },   // the switch in the roof of the top corridor
            { row: 3, col: 4, channel: 0 },   // and the gate across the second one
            { row: 6, col: 5, channel: 1 },   // the switch under the ice
            { row: 7, col: 4, channel: 1 }    // and the last gate, in front of the exit
        ]
    },
    {
        name: 'Cold Feet',
        start: { row: 7, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, G, F, F, F, F, F, F, C, W ],
            [ W, W, W, W, W, W, W, W, I, W ],
            [ W, W, W, V, W, W, W, W, I, W ],
            [ W, W, W, F, W, W, W, W, I, W ],
            [ W, S, W, F, W, W, W, W, I, W ],
            [ W, F, W, P, W, C, W, W, I, W ],
            [ W, F, F, F, I, I, I, I, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 5, col: 1, channel: 0 },   // the switch in the corner
            { row: 6, col: 3, channel: 0 }    // and the pit it fills in
        ]
    },
    {
        name: 'Trapdoor',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, T, F, F, V, W, W ],
            [ W, F, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, F, F, F, W ],
            [ W, W, W, W, S, W, W, W, F, W ],
            [ W, C, F, F, F, F, F, F, F, W ],
            [ W, P, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, C, F, F, F, G, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 4, col: 4, channel: 0 },   // one switch
            { row: 6, col: 1, channel: 0 },   // fills the pit in front of the exit
            { row: 1, col: 4, channel: 0 }    // and drops the floor behind you
        ]
    },
    {
        name: 'Slick Work',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, O, O, M, F, F, C, F, W ],
            [ W, W, W, W, W, W, W, W, F, W ],
            [ W, C, M, I, I, I, M, F, F, W ],
            [ W, F, W, W, W, W, W, W, F, W ],
            [ W, I, I, C, X, F, F, F, V, W ],
            [ W, F, W, W, W, W, W, W, M, W ],
            [ W, G, F, F, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ]
    },
    {
        name: 'Pressure Run',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, I, I, I, I, I, M, C, W ],
            [ W, W, W, V, F, S, W, W, F, W ],
            [ W, W, W, W, B, W, W, W, F, W ],
            [ W, W, W, W, H, W, W, W, F, W ],
            [ W, W, W, W, B, W, W, W, F, W ],
            [ W, W, W, W, F, W, W, W, M, W ],
            [ W, G, N, F, F, C, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 5, col: 4, channel: 0 },   // the plate at the foot of the shaft
            { row: 4, col: 4, channel: 0 },   // the gate it holds open
            { row: 3, col: 4, channel: 0 },   // and the plate that lets you back out
            { row: 2, col: 5, channel: 1 },   // the switch at the top of the shaft
            { row: 7, col: 2, channel: 1 }    // opens the last gate, by the exit
        ]
    },
    {
        name: 'The Vault',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, F, M, F, W ],
            [ W, W, W, S, W, W, W, W, H, W ],
            [ W, C, F, F, F, F, F, F, F, W ],
            [ W, H, W, W, W, S, W, W, W, W ],
            [ W, V, F, F, F, F, F, M, F, W ],
            [ W, W, W, W, S, W, W, W, H, W ],
            [ W, G, F, F, F, F, F, C, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 2, col: 3, channel: 0 },
            { row: 2, col: 8, channel: 0 },
            { row: 4, col: 5, channel: 1 },
            { row: 4, col: 1, channel: 1 },
            { row: 6, col: 4, channel: 2 },
            { row: 6, col: 8, channel: 2 }
        ]
    },
    {
        name: 'The Long Way Round',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, M, O, O, O, M, F, C, W ],
            [ W, F, W, W, W, W, W, W, D, W ],
            [ W, F, F, C, X, F, F, F, F, W ],
            [ W, F, F, X, C, F, X, F, F, W ],
            [ W, V, I, I, I, I, I, I, F, W ],
            [ W, P, W, W, S, W, W, W, F, W ],
            [ W, G, W, F, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 6, col: 4, channel: 0 },   // the switch under the rink
            { row: 6, col: 1, channel: 0 }    // and the pit in front of the exit
        ]
    }
]

},{"./tiles":15}],5:[function(require,module,exports){
module.exports = hrtime

// polyfil for window.performance.now
var performance = window.performance || {}
var performanceNow =
  performance.now        ||
  performance.now        ||
  performance.mozNow     ||
  performance.msNow      ||
  performance.oNow       ||
  performance.webkitNow  ||
  function(){ return (new Date()).getTime() }

// generate timestamp or delta
// see http://nodejs.org/api/process.html#process_process_hrtime
function hrtime(previousTimestamp){
  var clocktime = performanceNow.call(performance)/10e3
  var seconds = Math.floor(clocktime)
  var nanoseconds = (clocktime%1)*10e9
  if (previousTimestamp) {
    seconds = seconds - previousTimestamp[0]
    nanoseconds = nanoseconds - previousTimestamp[1]
    if (nanoseconds<0) {
      seconds--
      nanoseconds += 10e9
    }
  }
  return [seconds,nanoseconds]
}

},{}],6:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],7:[function(require,module,exports){
var inherits = require('inherits');
var EventEmitter = require('events').EventEmitter;
var defined = require('defined');
var raf = require('raf');
var defaultTimer = require('./lib/now.js');

module.exports = Engine;
inherits(Engine, EventEmitter);

function Engine (opts, fn) {
    if (!(this instanceof Engine)) return new Engine(opts, fn);
    EventEmitter.call(this);
    
    if (typeof opts === 'function') {
        fn = opts;
        opts = {};
    }
    if (!opts) opts = {};
    
    this.running = false;
    this.now = opts.now || defaultTimer;
    this.last = this.now();
    this.time = 0;
    this._timers = [];
    this._timerId = 1;
    this._fpsTarget = defined(opts.fps, 60);
    this._fpsWindow = defined(opts.fpsWindow, 1000);
    this._info = null;
    this.fps = 0;
    this._requestFrame = opts.requestFrame || raf;
    this._correction = defined(opts.correction,
        typeof window !== 'undefined' ? 0 : 1
    );
    if (fn) this.on('tick', fn);
}

Engine.prototype.run = function () {
    var self = this;
    if (this.running) return;
    this.running = true;
    this.last = this.now();
    this._info = { frames: 0, start: this.last };
    
    (function tick () {
        if (!self.running) return;
        self.tick();
        var elapsed = (self.now() - self.last) / 1000;
        var delay = Math.max(0, (1 / self._fpsTarget) - elapsed);
        var dms = delay * 1000 - self._correction;
        if (dms <= 2) self._requestFrame(tick)
        else setTimeout(function () { self._requestFrame(tick) }, dms)
    })();
};

Engine.prototype.pause = function () {
    this.running = false;
};

Engine.prototype.toggle = function () {
    if (this.running) this.pause()
    else this.run()
};

Engine.prototype.tick = function () {
    if (!this.running) return;
    
    var now = this.now();
    var dt = Math.max(0, now - this.last);
    this.last = now;
    this.time += dt;
    this.emit('tick', dt);
    
    if (this._info && this._fpsWindow
    && now - this._info.start > this._fpsWindow) {
        this.fps = this._info.frames / this._fpsWindow * 1000;
        this._info = { frames: 0, start: now };
        this.emit('fps', this.fps);
    }
    if (this._info) { this._info.frames ++ }
    
    do {
        var called = false;
        for (var i = 0; i < this._timers.length; i++) {
            var t = this._timers[i];
            if (t.time <= this.time) {
                var c = this._cleared && this._cleared[t.id];
                if (!c) {
                    called = true;
                    t.fn();
                }
                this._timers.splice(i, 1);
                i --;
            }
            else break;
        }
    } while (called);
    this._cleared = null;
};

Engine.prototype.setTimeout = function (fn, ts) {
    var id = this._timerId ++;
    this._pushTimer({ fn: fn, time: this.time + ts, id: id });
    return id;
};

Engine.prototype._pushTimer = function (rec) {
    for (var i = 0; i < this._timers.length; i++) {
        var t = this._timers[i];
        if (rec.time < t.time) {
            this._timers.splice(i, 0, rec);
            return;
        }
    }
    this._timers.push(rec);
};

Engine.prototype.setInterval = function (fn, ts) {
    var self = this;
    var first = self.time, times = 1;
    var f = function () {
        fn();
        self._pushTimer({ fn: f, time: first + (++ times) * ts, id: id });
    };
    var id = this._timerId ++;
    this._pushTimer({ fn: f, time: first + ts, id: id });
    return id;
};

Engine.prototype.clearTimeout =
Engine.prototype.clearInterval = function (id) {
    for (var i = 0; i < this._timers.length; i++) {
        var t = this._timers[i];
        if (t.id === id) {
            if (!this._cleared) this._cleared = {};
            this._cleared[id] = true;
            this._timers.splice(i, 1);
            break;
        }
    }
};

},{"./lib/now.js":8,"defined":9,"events":6,"inherits":10,"raf":13}],8:[function(require,module,exports){
(function (process){(function (){
var hrtime = typeof process !== 'undefined' && process
&& typeof process.hrtime === 'function'
    ? process.hrtime
    : require('browser-process-hrtime')
;

module.exports = function () {
    var t = hrtime();
    return (t[0] + t[1] / 1e9) * 1000;
};

}).call(this)}).call(this,require('_process'))
},{"_process":12,"browser-process-hrtime":5}],9:[function(require,module,exports){
module.exports = function () {
    for (var i = 0; i < arguments.length; i++) {
        if (arguments[i] !== undefined) return arguments[i];
    }
};

},{}],10:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      ctor.prototype = Object.create(superCtor.prototype, {
        constructor: {
          value: ctor,
          enumerable: false,
          writable: true,
          configurable: true
        }
      })
    }
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    if (superCtor) {
      ctor.super_ = superCtor
      var TempCtor = function () {}
      TempCtor.prototype = superCtor.prototype
      ctor.prototype = new TempCtor()
      ctor.prototype.constructor = ctor
    }
  }
}

},{}],11:[function(require,module,exports){
(function (process){(function (){
// Generated by CoffeeScript 1.6.3
(function() {
  var getNanoSeconds, hrtime, loadTime;

  if ((typeof performance !== "undefined" && performance !== null) && performance.now) {
    module.exports = function() {
      return performance.now();
    };
  } else if ((typeof process !== "undefined" && process !== null) && process.hrtime) {
    module.exports = function() {
      return (getNanoSeconds() - loadTime) / 1e6;
    };
    hrtime = process.hrtime;
    getNanoSeconds = function() {
      var hr;
      hr = hrtime();
      return hr[0] * 1e9 + hr[1];
    };
    loadTime = getNanoSeconds();
  } else if (Date.now) {
    module.exports = function() {
      return Date.now() - loadTime;
    };
    loadTime = Date.now();
  } else {
    module.exports = function() {
      return new Date().getTime() - loadTime;
    };
    loadTime = new Date().getTime();
  }

}).call(this);

/*

*/

}).call(this)}).call(this,require('_process'))
},{"_process":12}],12:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],13:[function(require,module,exports){
var now = require('performance-now')
  , global = typeof window === 'undefined' ? {} : window
  , vendors = ['moz', 'webkit']
  , suffix = 'AnimationFrame'
  , raf = global['request' + suffix]
  , caf = global['cancel' + suffix] || global['cancelRequest' + suffix]
  , isNative = true

for(var i = 0; i < vendors.length && !raf; i++) {
  raf = global[vendors[i] + 'Request' + suffix]
  caf = global[vendors[i] + 'Cancel' + suffix]
      || global[vendors[i] + 'CancelRequest' + suffix]
}

// Some versions of FF have rAF but not cAF
if(!raf || !caf) {
  isNative = false

  var last = 0
    , id = 0
    , queue = []
    , frameDuration = 1000 / 60

  raf = function(callback) {
    if(queue.length === 0) {
      var _now = now()
        , next = Math.max(0, frameDuration - (_now - last))
      last = next + _now
      setTimeout(function() {
        var cp = queue.slice(0)
        // Clear queue here to prevent
        // callbacks from appending listeners
        // to the current frame's queue
        queue.length = 0
        for(var i = 0; i < cp.length; i++) {
          if(!cp[i].cancelled) {
            try{
              cp[i].callback(last)
            } catch(e) {
              setTimeout(function() { throw e }, 0)
            }
          }
        }
      }, Math.round(next))
    }
    queue.push({
      handle: ++id,
      callback: callback,
      cancelled: false
    })
    return id
  }

  caf = function(handle) {
    for(var i = 0; i < queue.length; i++) {
      if(queue[i].handle === handle) {
        queue[i].cancelled = true
      }
    }
  }
}

module.exports = function(fn) {
  // Wrap in a new function to prevent
  // `cancel` potentially being assigned
  // to the native rAF function
  if(!isNative) {
    return raf.call(global, fn)
  }
  return raf.call(global, function() {
    try{
      fn.apply(this, arguments)
    } catch(e) {
      setTimeout(function() { throw e }, 0)
    }
  })
}
module.exports.cancel = function() {
  caf.apply(global, arguments)
}

},{"performance-now":11}],14:[function(require,module,exports){
// Builds the board out of the level grid, instead of the 90 hand-written <img>
// tags the page used to carry. Levels can now be any size.

var TILE_SIZE = 32

function tileSrc(tileNumber) {
    var padded = "00" + tileNumber
    return "tiles/tile" + padded.slice(-3) + ".gif"
}

module.exports = function createBoard(container, tileSize) {
    tileSize = tileSize || TILE_SIZE

    var images = []
    var ball = document.createElement("img")
    ball.src = "tiles/ball.png"
    ball.id = "ball"

    function draw(grid) {
        images = []
        container.innerHTML = ""

        var table = document.createElement("table")
        table.cellSpacing = 0
        table.cellPadding = 0

        grid.forEach(function(row) {
            var tr = document.createElement("tr")
            var imageRow = []

            row.forEach(function(tileNumber) {
                var td = document.createElement("td")
                var img = document.createElement("img")
                img.className = "mulg_tile"
                img.src = tileSrc(tileNumber)
                td.appendChild(img)
                tr.appendChild(td)
                imageRow.push(img)
            })

            images.push(imageRow)
            table.appendChild(tr)
        })

        container.appendChild(table)
        container.appendChild(ball)

        container.style.width = (grid[0].length * tileSize) + "px"
        container.style.height = (grid.length * tileSize) + "px"
    }

    function setTile(row, col, tileNumber) {
        images[row][col].src = tileSrc(tileNumber)
    }

    // Nothing on the page says the pass-through key exists, but once it is on
    // the marble itself shows it, by going see-through.
    function setBallGhost(on) {
        ball.className = on ? "ghost" : ""
    }

    // The page used to assign unitless numbers here, which only worked because
    // the document was in quirks mode.
    function setBallPos(x, y) {
        ball.style.left = x + "px"
        ball.style.top = y + "px"
    }

    return {
        draw: draw,
        setTile: setTile,
        setBallPos: setBallPos,
        setBallGhost: setBallGhost,
        tileSrc: tileSrc
    }
}

module.exports.tileSrc = tileSrc
module.exports.TILE_SIZE = TILE_SIZE

},{}],15:[function(require,module,exports){
// What the original Mulg tiles are and how they behave.
//
// Tile numbers, names and effects come from MulgEd's tile help, not from looking
// at the artwork. docs/original-tiles.md has the full table and the source.
// Anything this port does not implement yet is left as plain floor, so an
// unhandled tile is scenery rather than a wrong guess.

var FLOOR = 'floor'
var WALL = 'wall'
var GOAL = 'goal'
var COIN = 'coin'
var DEADLY = 'deadly'
var ONE_WAY = 'one-way'
var LETTER = 'letter'

var TILE = {
    EMPTY_PIT: 3,       // the ball falls in and the level is lost
    FLOOR: 4,
    TARGET_CROSS: 5,    // the exit
    BLOCK: 6,           // the basic wall
    LETTER: 7,          // carries a note the player collects and reads
    SWITCH_LOW: 9,      // a switch the ball bumps, off
    SWITCH_HIGH: 10,    // the same switch, on
    VGATE_CLOSED: 11,
    VGATE_OPEN: 14,
    HGATE_CLOSED: 15,
    HGATE_OPEN: 18,
    FLOOR_SWITCH_UP: 88,   // hidden in the floor, held down by the ball
    FLOOR_SWITCH_DOWN: 89,
    DEATH_CUBE: 42,     // deadly on contact
    ICY_FLOOR: 43,      // no friction
    ONE_WAY_LEFT: 44,
    ONE_WAY_RIGHT: 45,
    ONE_WAY_UP: 46,
    ONE_WAY_DOWN: 47,
    COIN_1: 98,
    COIN_5: 100,
    OIL: 111,           // slippery, and the player barely steers
    MUD: 112            // slows the ball to a stop
}

// The original wires activators to activated tiles through 32 channels. An
// activated tile has two forms and shows the other one while its channel is on.
var PARTNERS = {}

function pair(a, b) {
    PARTNERS[a] = b
    PARTNERS[b] = a
}

pair(TILE.EMPTY_PIT, TILE.FLOOR)        // a pit fills in, a floor drops away
pair(TILE.VGATE_CLOSED, TILE.VGATE_OPEN)
pair(TILE.HGATE_CLOSED, TILE.HGATE_OPEN)

// A gate does not jump between shut and open: the tile set carries the frames in
// between, which are what the barrier looks like part-way out of the wall.
var FRAME_SEQUENCES = [
    [ TILE.VGATE_CLOSED, 12, 13, TILE.VGATE_OPEN ],
    [ TILE.HGATE_CLOSED, 16, 17, TILE.HGATE_OPEN ]
]

// Switches show their own channel's state, so they have two forms as well.
var SWITCH_FORMS = [
    { off: TILE.SWITCH_LOW, on: TILE.SWITCH_HIGH, momentary: false },
    { off: TILE.FLOOR_SWITCH_UP, on: TILE.FLOOR_SWITCH_DOWN, momentary: true }
]

// How a square treats the ball rolling over it. `decayOn` applies while the
// player is pushing, `decayOff` while the ball coasts, and `control` scales how
// much a keypress is worth. Floor keeps the numbers the port has always used.
var SURFACES = {}
var FLOOR_SURFACE = { decayOn: 0.99, decayOff: 0.9, control: 1 }

SURFACES[TILE.ICY_FLOOR] = { decayOn: 1, decayOff: 1, control: 1 }
SURFACES[TILE.OIL] = { decayOn: 1, decayOff: 1, control: 0.25 }
SURFACES[TILE.MUD] = { decayOn: 0.6, decayOff: 0.45, control: 1 }

var ONE_WAY_DIRECTIONS = {}
ONE_WAY_DIRECTIONS[TILE.ONE_WAY_LEFT] = 'left'
ONE_WAY_DIRECTIONS[TILE.ONE_WAY_RIGHT] = 'right'
ONE_WAY_DIRECTIONS[TILE.ONE_WAY_UP] = 'up'
ONE_WAY_DIRECTIONS[TILE.ONE_WAY_DOWN] = 'down'

var KINDS = {}

function classify(kind, tileNumbers, extra) {
    tileNumbers.forEach(function(tileNumber) {
        var info = { kind: kind }
        for (var key in extra) info[key] = extra[key]
        KINDS[tileNumber] = info
    })
}

// Blocking. The switches, boxes, Hanoi pieces, walkers, magnets and the closed
// gates all have their own behaviour in the original; until that is written they
// are at least solid, which is how they read on the board. A gate part-way open
// is solid too, so the ball cannot squeeze through one that is still moving.
classify(WALL, [
    TILE.BLOCK,
    9, 10,          // switches, low and high
    11, 12, 13,     // vertical gate, shut and opening
    15, 16, 17,     // horizontal gate, shut and opening
    38, 113,        // heavy box, light box
    133, 134, 135, 136, 137, 138, 139, // Hanoi tower pieces
    140, 141, 142, 143,                // walkers
    144,            // exchange
    145, 146        // magnets
])

classify(GOAL, [ TILE.TARGET_CROSS ])
classify(LETTER, [ TILE.LETTER ])

// 87 is a descending floor with no crossings left, so stepping on it is a fall.
classify(DEADLY, [ TILE.EMPTY_PIT, TILE.DEATH_CUBE, 87 ])

classify(COIN, [ TILE.COIN_1 ], { value: 1 })
classify(COIN, [ TILE.COIN_5 ], { value: 5 })

Object.keys(ONE_WAY_DIRECTIONS).forEach(function(tileNumber) {
    classify(ONE_WAY, [ Number(tileNumber) ], { direction: ONE_WAY_DIRECTIONS[tileNumber] })
})

var FLOOR_INFO = { kind: FLOOR }

// Everything else is scenery the ball rolls straight over.
function tileInfo(tileNumber) {
    return KINDS[tileNumber] || FLOOR_INFO
}

function isWall(tileNumber) {
    return tileInfo(tileNumber).kind === WALL
}

function isGoal(tileNumber) {
    return tileInfo(tileNumber).kind === GOAL
}

function isDeadly(tileNumber) {
    return tileInfo(tileNumber).kind === DEADLY
}

function isCoin(tileNumber) {
    return tileInfo(tileNumber).kind === COIN
}

function coinValue(tileNumber) {
    return isCoin(tileNumber) ? tileInfo(tileNumber).value : 0
}

// The direction a one-way tile lets the ball travel, or null if it is not one.
function oneWayDirection(tileNumber) {
    var info = tileInfo(tileNumber)
    return info.kind === ONE_WAY ? info.direction : null
}

function surface(tileNumber) {
    return SURFACES[tileNumber] || FLOOR_SURFACE
}

// The frames a tile animates through, in order from shut to open, or null if it
// changes in one step.
function frameSequence(tileNumber) {
    for (var i = 0; i < FRAME_SEQUENCES.length; i++) {
        if (FRAME_SEQUENCES[i].indexOf(tileNumber) !== -1) return FRAME_SEQUENCES[i]
    }

    return null
}

function isLetter(tileNumber) {
    return tileInfo(tileNumber).kind === LETTER
}

// A gate in any state but fully open: shut, or part-way through sliding. mulg.c
// treats all of those as solid, and kills the marble that turns out to be inside
// one, which is how a gate closing on the ball costs a life.
function isClosedGate(tileNumber) {
    for (var i = 0; i < FRAME_SEQUENCES.length; i++) {
        var frames = FRAME_SEQUENCES[i]
        var frame = frames.indexOf(tileNumber)

        if (frame !== -1) return frame < frames.length - 1
    }

    return false
}

// The other form of a tile that can be switched, or null if it has none.
function activatedPartner(tileNumber) {
    return PARTNERS[tileNumber] === undefined ? null : PARTNERS[tileNumber]
}

// The pair of forms for a switch, or null if this tile is not one. A momentary
// switch is held on only while the ball is on it; the other kind toggles.
function switchForms(tileNumber) {
    for (var i = 0; i < SWITCH_FORMS.length; i++) {
        if (SWITCH_FORMS[i].off === tileNumber || SWITCH_FORMS[i].on === tileNumber) {
            return SWITCH_FORMS[i]
        }
    }

    return null
}

module.exports = {
    FLOOR: FLOOR,
    WALL: WALL,
    GOAL: GOAL,
    COIN: COIN,
    DEADLY: DEADLY,
    ONE_WAY: ONE_WAY,
    TILE: TILE,
    FLOOR_SURFACE: FLOOR_SURFACE,
    tileInfo: tileInfo,
    isWall: isWall,
    isGoal: isGoal,
    isDeadly: isDeadly,
    isCoin: isCoin,
    coinValue: coinValue,
    oneWayDirection: oneWayDirection,
    surface: surface,
    activatedPartner: activatedPartner,
    switchForms: switchForms,
    frameSequence: frameSequence,
    isClosedGate: isClosedGate,
    isLetter: isLetter,
    LETTER: LETTER,
    CHANNELS: 32
}

},{}]},{},[3]);
