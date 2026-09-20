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

var REGISTER_KEYPRESSES_EVERY_MS = 50
// How long a gate rests on each frame as it slides open or shut. The original
// steps a door on every fourth animation tick, and a tick is the 40 ms its clock
// counts per frame, so a door takes about half a second end to end.
var GATE_FRAME_MS = 160
var LIVES_PER_GAME = 3

var OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' }

// The exit only counts in the middle of its square. The original reads the
// marble's position in sixteenths of a tile and asks for 5 to 9 on both axes, so
// the marble can clip a corner of the exit and roll on.
var GOAL_MIN_16TH = 5
var GOAL_MAX_16TH = 9

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
    // Floor buttons, which carry their own armed-or-spent state rather than the
    // channel's.
    var buttons = []
    var standingOn = null
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
    // ball is not travelling the way it points.
    //
    // The original is stricter than "no going back": a one-way pointing right
    // refuses a ball coming from above or below as well, and only lets through one
    // travelling straight the way the arrow points. A square merely touched,
    // without being entered, always passes - the original's `dir == 0`, which is
    // what a call with no direction means here.
    function blocks(tileNumber, direction) {
        if (ghost) return false
        if (tiles.isWall(tileNumber)) return true

        var oneWay = tiles.oneWayDirection(tileNumber)
        if (oneWay === null) return false

        return direction !== undefined && oneWay !== direction
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
        switchCells = []
        buttons = [];

        (level.wiring || []).forEach(function(wire) {
            wiring[wire.row + ',' + wire.col] = wire.channel

            var tile = game.grid[wire.row][wire.col]
            var forms = tiles.switchForms(tile)

            if (forms) {
                var cell = { row: wire.row, col: wire.col, channel: wire.channel, forms: forms }

                if (forms.thrownBy === tiles.ROLLED_ONTO) buttons.push(cell)
                else switchCells.push(cell)

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
        if (forms && forms.thrownBy === tiles.BUMPED) setChannel(channel, !channels[channel])
    }

    // The ball rolled onto a square. An armed floor button throws its channel and
    // is spent by it; every other button on that channel is re-armed, so a lone
    // button works once and a pair of them toggle back and forth.
    function rollOntoSquare(at) {
        var pressed = null

        buttons.forEach(function(button) {
            if (button.row === at.row && button.col === at.col &&
                game.grid[button.row][button.col] === button.forms.off) pressed = button
        })

        if (!pressed) return

        buttons.forEach(function(button) {
            if (button.channel !== pressed.channel) return
            setTile(button.row, button.col, button === pressed ? button.forms.on : button.forms.off)
        })

        setChannel(pressed.channel, !channels[pressed.channel])
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

    function bumped(row, col) {
        var at = wrapped(row, col)
        throwSwitchAt(at.row, at.col)
    }

    function clamp(speed) {
        if (speed > BALL_MAX_SPEED) return BALL_MAX_SPEED
        if (speed < -BALL_MAX_SPEED) return -BALL_MAX_SPEED
        return speed
    }

    function updateBallPos(updateMomentum) {
        var ball = game.ball
        var under = ballSquare().tile
        var surface = tiles.surface(under)

        if (updateMomentum) {
            var extrax = ((game.input.right ? 1 : 0) - (game.input.left ? 1 : 0)) * surface.control
            var extray = ((game.input.down ? 1 : 0) - (game.input.up ? 1 : 0)) * surface.control
            ball.sx = clamp((ball.sx + extrax) * (extrax ? surface.decayOn : surface.decayOff))
            ball.sy = clamp((ball.sy + extray) * (extray ? surface.decayOn : surface.decayOff))
        }

        if (ball.sx > 0 && ballIX() > 9 && checkForCollision(ballRow(), ballCol() + 1, 'right')) {
            bumped(ballRow(), ballCol() + 1)
            ball.sx = -ball.sx
        } else if (ball.sx < 0 && ballIX() < 5 && checkForCollision(ballRow(), ballCol() - 1, 'left')) {
            bumped(ballRow(), ballCol() - 1)
            ball.sx = -ball.sx
        }

        if (ball.sy > 0 && ballIY() > 9 && checkForCollision(ballRow() + 1, ballCol(), 'down')) {
            bumped(ballRow() + 1, ballCol())
            ball.sy = -ball.sy
        } else if (ball.sy < 0 && ballIY() < 5 && checkForCollision(ballRow() - 1, ballCol(), 'up')) {
            bumped(ballRow() - 1, ballCol())
            ball.sy = -ball.sy
        }

        // Nothing restrains a ball already standing on a one-way: the original
        // only ever checks the square being entered, so a ball that got onto an
        // arrow can leave it in any direction. What stops it going back is the
        // next arrow along, not the one under it.

        // http://www.w3schools.com/jsref/jsref_abs.asp
        if (Math.abs(ball.sx) < BALL_SPEED_THRESH) ball.sx = 0
        if (Math.abs(ball.sy) < BALL_SPEED_THRESH) ball.sy = 0

        ball.x = wrapCoord(ball.x + ball.sx / FPS_MULTIPLIER, OFFSET_X, game.grid[0].length * TILE_SIZE)
        ball.y = wrapCoord(ball.y + ball.sy / FPS_MULTIPLIER, OFFSET_Y, game.grid.length * TILE_SIZE)
    }

    /***** What the ball is standing on *****/

    function stop() {
        game.ball.sx = 0
        game.ball.sy = 0
    }

    function die() {
        game.lives = game.lives - 1
        stop()

        if (game.lives > 0) {
            game.status = DEAD
            game.message = 'Ouch. Press R to try again, ' + game.lives + ' left.'
        } else {
            game.status = GAME_OVER
            game.message = 'Game over. Press R to start again.'
        }
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

    // In the middle of the square, in the sixteenths the original works in.
    function overSquareCentre() {
        var ix = Math.floor(ballIX())
        var iy = Math.floor(ballIY())

        return ix >= GOAL_MIN_16TH && ix <= GOAL_MAX_16TH &&
               iy >= GOAL_MIN_16TH && iy <= GOAL_MAX_16TH
    }

    function checkWhatBallIsOn() {
        var here = ballSquare()
        var enteringNew = !standingOn || standingOn.row !== here.row || standingOn.col !== here.col

        if (enteringNew) {
            standingOn = { row: here.row, col: here.col }
            rollOntoSquare(standingOn)
            here = ballSquare()
        }

        // A descending floor gives way one step per crossing, and the last step
        // leaves an open pit, which the deadly check below then falls into.
        if (enteringNew) {
            var worn = tiles.wornBy(here.tile)

            if (worn !== null) {
                setTile(here.row, here.col, worn)
                here = ballSquare()
            }
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
        } else if (tiles.isDeadly(here.tile)) {
            die()
        } else if (tiles.isGoal(here.tile) && overSquareCentre()) {
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
        updateBallPos(updateMomentum)
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
