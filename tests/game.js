var test = require('tape')
var createGame = require('../game')
var tiles = require('../tiles')

var W = tiles.TILE.BLOCK
var F = tiles.TILE.FLOOR
var G = tiles.TILE.TARGET_CROSS
var C = tiles.TILE.COIN_1
var V = tiles.TILE.COIN_5
var X = tiles.TILE.DEATH_CUBE

// A one-row corridor the ball can be rolled along from left to right.
function corridor(name, row) {
	var floor = [ W ].concat(row).concat([ W ])
	var walls = floor.map(function() { return W })

	return {
		name: name,
		start: { row: 1, col: 1 },
		tiles: [ walls, floor, walls ]
	}
}

// Holds a direction down for a while. 'none' lets the ball coast.
function roll(game, direction, ticks) {
	if (direction !== 'none') game.input[direction] = true

	for (var i = 0; i < ticks; i++) {
		game.tick(16)
		if (game.status !== createGame.PLAYING) break
	}

	if (direction !== 'none') game.input[direction] = false
}

test('a new game starts on the first level, with lives and no score', function(t) {
	var game = createGame([ corridor('one', [ F, F, G ]), corridor('two', [ F, F, G ]) ])

	t.equal(game.levelIndex, 0)
	t.equal(game.level.name, 'one')
	t.equal(game.status, createGame.PLAYING)
	t.equal(game.score, 0)
	t.equal(game.lives, 3)
	t.equal(game.ballSquare().row, 1)
	t.equal(game.ballSquare().col, 1)
	t.end()
})

test('the level is played on a copy, so the original data survives', function(t) {
	var levels = [ corridor('one', [ F, C, G ]) ]
	var game = createGame(levels)

	roll(game, 'right', 300)

	t.equal(game.score, 1, 'the coin was picked up')
	t.equal(levels[0].tiles[1][2], C, 'the level data still has its coin')
	t.end()
})

test('rolling over a coin scores it and clears the square', function(t) {
	var game = createGame([ corridor('one', [ F, V, F ]) ])

	roll(game, 'right', 200)

	t.equal(game.score, 5, 'a five-coin is worth five')
	t.equal(game.grid[1][2], tiles.TILE.FLOOR, 'the coin is gone from the board')

	var changes = game.consumeTileChanges()
	t.equal(changes.length, 1, 'the renderer is told to repaint one square')
	t.deepEqual(changes[0], { row: 1, col: 2, tile: tiles.TILE.FLOOR })

	t.equal(game.consumeTileChanges().length, 0, 'changes are only handed over once')
	t.end()
})

test('a coin is only scored once', function(t) {
	var game = createGame([ corridor('one', [ C, F, F ]) ])

	roll(game, 'right', 40)
	roll(game, 'left', 200)
	roll(game, 'right', 200)

	t.equal(game.score, 1)
	t.end()
})

test('reaching the goal wins the level and stops the ball', function(t) {
	var game = createGame([ corridor('one', [ F, F, G ]), corridor('two', [ F, F, G ]) ])

	roll(game, 'right', 400)

	t.equal(game.status, createGame.LEVEL_WON)
	t.equal(game.ball.sx, 0, 'the ball is stopped')
	t.ok(game.message.length > 0, 'the player is told what to do next')
	t.end()
})

test('a won level does not tick on until the player presses on', function(t) {
	var game = createGame([ corridor('one', [ F, F, G ]), corridor('two', [ F, F, G ]) ])

	roll(game, 'right', 400)
	var restingAt = game.ball.x
	var wonAt = game.elapsedMs

	roll(game, 'right', 100)

	t.equal(game.ball.x, restingAt, 'the ball has not moved')
	t.equal(game.elapsedMs, wonAt, 'the clock has stopped')
	t.end()
})

test('pressing on after a win loads the next level and keeps the score', function(t) {
	var game = createGame([ corridor('one', [ C, F, G ]), corridor('two', [ F, F, G ]) ])

	roll(game, 'right', 400)
	t.equal(game.score, 1)

	game.advance()

	t.equal(game.levelIndex, 1)
	t.equal(game.level.name, 'two')
	t.equal(game.status, createGame.PLAYING)
	t.equal(game.score, 1, 'the score carries over')
	t.equal(game.elapsedMs, 0, 'the clock restarts')
	t.equal(game.ballSquare().col, 1, 'the ball is back at the start')
	t.end()
})

test('finishing the last level wins the game', function(t) {
	var game = createGame([ corridor('only', [ F, F, G ]) ])

	roll(game, 'right', 400)

	t.equal(game.status, createGame.GAME_WON)
	t.end()
})

test('a deadly square costs a life', function(t) {
	var game = createGame([ corridor('one', [ F, X, G ]) ])

	roll(game, 'right', 300)

	t.equal(game.status, createGame.DEAD)
	t.equal(game.lives, 2)
	t.end()
})

test('pressing on after dying restarts the level', function(t) {
	var game = createGame([ corridor('one', [ C, X, G ]) ])

	roll(game, 'right', 300)
	t.equal(game.score, 1)
	t.equal(game.status, createGame.DEAD)

	game.advance()

	t.equal(game.levelIndex, 0, 'still on the same level')
	t.equal(game.status, createGame.PLAYING)
	t.equal(game.grid[1][1], C, 'the coin is back')
	t.end()
})

test('running out of lives ends the game, and pressing on starts a fresh one', function(t) {
	var game = createGame([ corridor('one', [ C, X, G ]) ], { lives: 2 })

	roll(game, 'right', 300)
	t.equal(game.status, createGame.DEAD)
	t.equal(game.lives, 1)

	game.advance()
	roll(game, 'right', 300)

	t.equal(game.lives, 0)
	t.equal(game.status, createGame.GAME_OVER)

	game.advance()

	t.equal(game.status, createGame.PLAYING)
	t.equal(game.lives, 2, 'lives are back')
	t.equal(game.score, 0, 'the score starts again')
	t.equal(game.levelIndex, 0)
	t.end()
})

test('walls stop the ball', function(t) {
	var game = createGame([ corridor('one', [ F, F, F ]) ])

	roll(game, 'right', 600)

	t.ok(game.ballSquare().col <= 3, 'the ball stayed inside the corridor')
	t.equal(game.status, createGame.PLAYING)
	t.end()
})

test('the clock runs while playing', function(t) {
	var game = createGame([ corridor('one', [ F, F, F ]) ])

	t.equal(game.elapsedMs, 0)
	roll(game, 'right', 10)
	t.equal(game.elapsedMs, 160)
	t.end()
})

test('restarting a level puts the coins back and the score with them', function(t) {
	var game = createGame([ corridor('one', [ C, X, G ]) ])

	roll(game, 'right', 300)
	t.equal(game.score, 1, 'the coin was picked up before dying')

	game.advance()
	t.equal(game.score, 0, 'the score for this level is given back with the coin')
	t.equal(game.grid[1][1], C)

	roll(game, 'right', 300)
	t.equal(game.score, 1, 'and the same coin can only ever be worth one')
	t.end()
})

test('coins picked up on a finished level are banked', function(t) {
	var game = createGame([ corridor('one', [ C, F, G ]), corridor('two', [ C, X, G ]) ])

	roll(game, 'right', 400)
	t.equal(game.status, createGame.LEVEL_WON)
	t.equal(game.score, 1)

	game.advance()
	roll(game, 'right', 400)
	t.equal(game.status, createGame.DEAD)
	t.equal(game.score, 2, 'one from each level')

	game.advance()
	t.equal(game.score, 1, "only the second level's coin is given back")
	t.end()
})

test('an empty pit costs a life, like the death cube', function(t) {
	var game = createGame([ corridor('one', [ F, tiles.TILE.EMPTY_PIT, G ]) ])

	roll(game, 'right', 300)

	t.equal(game.status, createGame.DEAD)
	t.equal(game.lives, 2)
	t.end()
})

test('ice does not slow the ball down, floor does', function(t) {
	var I = tiles.TILE.ICY_FLOOR

	function coastingSpeed(row) {
		var game = createGame([ corridor('one', row) ])

		roll(game, 'right', 30)   // get it moving
		roll(game, 'none', 40)    // then let go and coast

		return Math.abs(game.ball.sx)
	}

	var onIce = coastingSpeed([ I, I, I, I, I, I, I, I ])
	var onFloor = coastingSpeed([ F, F, F, F, F, F, F, F ])

	t.ok(onIce > onFloor, 'the ball is still moving faster on ice (' + onIce + ' vs ' + onFloor + ')')
	t.end()
})

test('mud brings the ball to a stop sooner than floor does', function(t) {
	var M = tiles.TILE.MUD

	function coastingSpeed(row) {
		var game = createGame([ corridor('one', row) ])

		roll(game, 'right', 30)
		roll(game, 'none', 20)

		return Math.abs(game.ball.sx)
	}

	t.ok(coastingSpeed([ M, M, M, M, M, M, M, M ]) < coastingSpeed([ F, F, F, F, F, F, F, F ]))
	t.end()
})

test('a one-way tile will not let the ball turn back through it', function(t) {
	var R = tiles.TILE.ONE_WAY_RIGHT
	var game = createGame([ corridor('one', [ F, R, F, F, F, F ]) ])

	roll(game, 'right', 120)
	var past = game.ballSquare().col
	t.ok(past > 2, 'the ball got through the one-way going right')

	roll(game, 'left', 400)

	t.ok(game.ballSquare().col > 2, 'and cannot get back past it')
	t.end()
})

test('a one-way tile can still be entered the way it points', function(t) {
	var R = tiles.TILE.ONE_WAY_RIGHT
	var game = createGame([ corridor('one', [ R, F, F, F ]) ])

	roll(game, 'right', 200)

	t.ok(game.ballSquare().col > 1, 'the ball rolled on through')
	t.end()
})
