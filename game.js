// The rules of the game, with no DOM in sight, so they can be played out in a
// test as well as in a browser. index.js wires this up to the page.

var collisionChecker = require('./collision-checking')
var tiles = require('./tiles')

var TILE_SIZE = 32
var FPS_MULTIPLIER = 3 // based on 20fps
var OFFSET_X = 14
var OFFSET_Y = 14

var BALL_SPEED_DECAY_ON = 0.99
var BALL_SPEED_DECAY_OFF = 0.9
var BALL_SPEED_THRESH = 0.1

var REGISTER_KEYPRESSES_EVERY_MS = 50
var LIVES_PER_GAME = 3

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
        input: { left: false, right: false, up: false, down: false }
    }

    var checkForCollision = null
    var tileChanges = []
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

    function ballSquare() {
        var height = game.grid.length
        var width = game.grid[0].length
        var row = Math.floor((ballRow() + height) % height)
        var col = Math.floor((ballCol() + width) % width)
        return { row: row, col: col, tile: game.grid[row][col] }
    }

    /***** Loading and restarting *****/

    function loadLevel(index, keepScore) {
        game.levelIndex = index
        game.level = levels[index]
        // Coins vanish as they are collected, so play on a copy of the level.
        game.grid = copyGrid(game.level.tiles)
        checkForCollision = collisionChecker(game.grid, tiles.isWall)

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

    /***** Movement *****/

    function updateBallPos(updateMomentum) {
        var ball = game.ball

        if (updateMomentum) {
            var extrax = (game.input.right ? 1 : 0) - (game.input.left ? 1 : 0)
            var extray = (game.input.down ? 1 : 0) - (game.input.up ? 1 : 0)
            ball.sx = (ball.sx + extrax) * (extrax ? BALL_SPEED_DECAY_ON : BALL_SPEED_DECAY_OFF)
            ball.sy = (ball.sy + extray) * (extray ? BALL_SPEED_DECAY_ON : BALL_SPEED_DECAY_OFF)
        }

        if ((ball.sx > 0 && ballIX() > 9 && checkForCollision(ballRow(), ballCol() + 1)) ||
            (ball.sx < 0 && ballIX() < 5 && checkForCollision(ballRow(), ballCol() - 1))) {
            ball.sx = -ball.sx
        }

        if ((ball.sy > 0 && ballIY() > 9 && checkForCollision(ballRow() + 1, ballCol())) ||
            (ball.sy < 0 && ballIY() < 5 && checkForCollision(ballRow() - 1, ballCol()))) {
            ball.sy = -ball.sy
        }

        // http://www.w3schools.com/jsref/jsref_abs.asp
        if (Math.abs(ball.sx) < BALL_SPEED_THRESH) ball.sx = 0
        if (Math.abs(ball.sy) < BALL_SPEED_THRESH) ball.sy = 0

        ball.x = ball.x + ball.sx / FPS_MULTIPLIER
        ball.y = ball.y + ball.sy / FPS_MULTIPLIER
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

    function checkWhatBallIsOn() {
        var here = ballSquare()

        if (tiles.isCoin(here.tile)) {
            game.score = game.score + tiles.coinValue(here.tile)
            game.grid[here.row][here.col] = tiles.TILE.FLOOR
            tileChanges.push({ row: here.row, col: here.col, tile: tiles.TILE.FLOOR })
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
    game.startNewGame = startNewGame
    game.consumeTileChanges = consumeTileChanges
    game.ballSquare = ballSquare

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
