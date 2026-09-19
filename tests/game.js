var test = require('tape')
var createGame = require('../game')
var levels = require('../levels')
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

	function walls() {
		return floor.map(function() { return W })
	}

	return {
		name: name,
		start: { row: 1, col: 1 },
		tiles: [ walls(), floor, walls() ]
	}
}

// Holds a direction down until something happens, or the ticks run out. Bumping
// a switch is a toggle, so a test that wants one bump has to stop at it.
function rollUntil(game, direction, done, ticks) {
	game.input[direction] = true

	for (var i = 0; i < ticks; i++) {
		game.tick(16)
		if (done() || game.status !== createGame.PLAYING) break
	}

	game.input[direction] = false
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

var SWITCH = tiles.TILE.SWITCH_LOW
var FLOOR_SWITCH = tiles.TILE.FLOOR_SWITCH_UP
var VGATE = tiles.TILE.VGATE_CLOSED
var PIT = tiles.TILE.EMPTY_PIT

test('bumping a switch throws its channel and opens the gate on it', function(t) {
	var level = corridor('one', [ F, F, SWITCH ])
	level.tiles[2][3] = VGATE   // in the wall below, out of the ball's way
	level.wiring = [
		{ row: 1, col: 3, channel: 0 },
		{ row: 2, col: 3, channel: 0 }
	]

	var game = createGame([ level ])

	t.notOk(game.channelOn(0), 'the channel starts off')
	t.equal(game.grid[2][3], VGATE, 'the gate starts closed')

	rollUntil(game, 'right', function() { return game.channelOn(0) }, 400)

	t.ok(game.channelOn(0), 'bumping the switch threw the channel')
	t.equal(game.grid[1][3], tiles.TILE.SWITCH_HIGH, 'the switch shows as thrown')

	roll(game, 'none', 40)   // the gate takes a moment to slide open

	t.equal(game.grid[2][3], tiles.TILE.VGATE_OPEN, 'the gate opened')
	t.notOk(tiles.isWall(game.grid[2][3]), 'and it is no longer solid')
	t.end()
})

test('an opened gate closes again when the switch is thrown back', function(t) {
	var level = corridor('one', [ F, F, SWITCH ])
	level.tiles[2][3] = VGATE
	level.wiring = [
		{ row: 1, col: 3, channel: 0 },
		{ row: 2, col: 3, channel: 0 }
	]

	var game = createGame([ level ])

	rollUntil(game, 'right', function() { return game.channelOn(0) }, 400)
	t.ok(game.channelOn(0))

	roll(game, 'left', 30)
	rollUntil(game, 'right', function() { return !game.channelOn(0) }, 400)

	t.notOk(game.channelOn(0), 'the second bump threw it back')

	roll(game, 'none', 40)

	t.equal(game.grid[2][3], VGATE, 'the gate is closed again')
	t.end()
})

test('a wired pit fills in when its channel comes on', function(t) {
	var level = corridor('one', [ F, F, SWITCH ])
	level.tiles[2][2] = PIT
	level.wiring = [
		{ row: 1, col: 3, channel: 3 },
		{ row: 2, col: 2, channel: 3 }
	]

	var game = createGame([ level ])

	t.ok(tiles.isDeadly(game.grid[2][2]), 'the pit starts open')

	rollUntil(game, 'right', function() { return game.channelOn(3) }, 400)

	t.equal(game.grid[2][2], tiles.TILE.FLOOR, 'the pit filled in')
	t.notOk(tiles.isDeadly(game.grid[2][2]))
	t.end()
})

test('a floor switch is only on while the ball is on it', function(t) {
	var level = corridor('one', [ FLOOR_SWITCH, F, F, F ])
	level.tiles[2][2] = VGATE
	level.wiring = [
		{ row: 1, col: 1, channel: 7 },
		{ row: 2, col: 2, channel: 7 }
	]

	var game = createGame([ level ])

	// The ball starts on the floor switch, so one tick presses it.
	roll(game, 'none', 2)
	t.ok(game.channelOn(7), 'standing on it holds it down')
	t.equal(game.grid[1][1], tiles.TILE.FLOOR_SWITCH_DOWN, 'and it shows as pressed')

	roll(game, 'right', 200)

	t.notOk(game.channelOn(7), 'rolling off lets it back up')
	t.equal(game.grid[1][1], FLOOR_SWITCH)

	roll(game, 'none', 40)

	t.equal(game.grid[2][2], VGATE, 'so the gate closed again')
	t.end()
})

test('the renderer is told about every square a channel changes', function(t) {
	var level = corridor('one', [ F, F, SWITCH ])
	level.tiles[2][3] = VGATE
	level.wiring = [
		{ row: 1, col: 3, channel: 0 },
		{ row: 2, col: 3, channel: 0 }
	]

	var game = createGame([ level ])

	rollUntil(game, 'right', function() { return game.channelOn(0) }, 400)
	roll(game, 'none', 40)

	var changed = game.consumeTileChanges().map(function(change) {
		return change.row + ',' + change.col
	})

	t.ok(changed.indexOf('1,3') !== -1, 'the switch')
	t.ok(changed.indexOf('2,3') !== -1, 'and the gate')
	t.end()
})

test('channels start off and a level restart puts them back', function(t) {
	var level = corridor('one', [ F, F, SWITCH ])
	level.tiles[2][3] = VGATE
	level.wiring = [
		{ row: 1, col: 3, channel: 0 },
		{ row: 2, col: 3, channel: 0 }
	]

	var game = createGame([ level ])

	rollUntil(game, 'right', function() { return game.channelOn(0) }, 400)
	roll(game, 'none', 40)
	t.ok(game.channelOn(0))

	game.advance()

	t.notOk(game.channelOn(0), 'the channel is off again')
	t.equal(game.grid[2][3], VGATE, 'and the gate is closed again')
	t.end()
})

// Level 4 shipped unwinnable: its pit lay across the only corridor to the exit
// and was wired to nothing, so there was no way past it and nothing to fill it
// in with. It has a switch now, and these play that out on the level as shipped.
//
// Which squares can be reached is tests/levels.js' job. This puts the ball where
// it needs to be and checks what the rules then do, because a route the grid
// allows still has to work under the marble's own momentum.
function level4() {
	var game = createGame(levels)

	while (game.levelIndex < 3) {
		game.status = createGame.LEVEL_WON
		game.advance()
	}

	return game
}

function placeBall(game, row, col) {
	game.ball.x = col * createGame.TILE_SIZE
	game.ball.y = row * createGame.TILE_SIZE
	game.ball.sx = 0
	game.ball.sy = 0
}

test('level 4: the switch below the corridor fills its pit in', function(t) {
	var game = level4()

	t.equal(game.level.name, 'Slippery', 'this is the level that could not be won')
	t.ok(tiles.isDeadly(game.grid[5][4]), 'the pit starts open')

	placeBall(game, 5, 1)
	rollUntil(game, 'down', function() { return game.channelOn(0) }, 300)

	t.ok(game.channelOn(0), 'rolling into the switch threw its channel')
	t.equal(game.grid[5][4], tiles.TILE.FLOOR, 'which filled the pit in')
	t.equal(game.status, createGame.PLAYING, 'and throwing it is safe')
	t.end()
})

test('level 4: the filled pit can be crossed, the open one cannot', function(t) {
	var open = level4()

	placeBall(open, 5, 1)
	rollUntil(open, 'right', function() { return open.ballSquare().col >= 7 }, 600)

	t.equal(open.status, createGame.DEAD, 'rolling along row 5 into the open pit is fatal')
	t.equal(open.ballSquare().col, 4, 'and the ball gets no further than the pit')

	var filled = level4()

	placeBall(filled, 5, 1)
	rollUntil(filled, 'down', function() { return filled.channelOn(0) }, 300)
	placeBall(filled, 5, 1)
	rollUntil(filled, 'right', function() { return filled.ballSquare().col >= 7 }, 600)

	t.equal(filled.status, createGame.PLAYING, 'with the switch thrown the ball survives row 5')
	t.ok(filled.ballSquare().col >= 7, 'and reaches the far side, where the exit is')
	t.equal(filled.lives, 3, 'without losing a life')
	t.end()
})

test('a gate slides open through its in-between frames', function(t) {
	var level = corridor('one', [ F, F, SWITCH ])
	level.tiles[2][3] = VGATE
	level.wiring = [
		{ row: 1, col: 3, channel: 0 },
		{ row: 2, col: 3, channel: 0 }
	]

	var game = createGame([ level ])
	var frames = tiles.frameSequence(VGATE)
	var seen = []

	rollUntil(game, 'right', function() { return game.channelOn(0) }, 400)

	for (var i = 0; i < 40; i++) {
		game.tick(16)
		var showing = game.grid[2][3]
		if (seen[seen.length - 1] !== showing) seen.push(showing)
	}

	t.deepEqual(seen, frames, 'it passed through every frame in order, shut to open')
	t.ok(seen.length > 2, 'it did not jump straight to open')
	t.end()
})

test('a gate slides shut again the same way, backwards', function(t) {
	var level = corridor('one', [ F, F, SWITCH ])
	level.tiles[2][3] = VGATE
	level.wiring = [
		{ row: 1, col: 3, channel: 0 },
		{ row: 2, col: 3, channel: 0 }
	]

	var game = createGame([ level ])

	rollUntil(game, 'right', function() { return game.channelOn(0) }, 400)
	roll(game, 'none', 40)
	t.equal(game.grid[2][3], tiles.TILE.VGATE_OPEN)

	roll(game, 'left', 30)
	rollUntil(game, 'right', function() { return !game.channelOn(0) }, 400)

	var seen = []
	for (var i = 0; i < 40; i++) {
		game.tick(16)
		var showing = game.grid[2][3]
		if (seen[seen.length - 1] !== showing) seen.push(showing)
	}

	t.deepEqual(seen, [ tiles.TILE.VGATE_OPEN, 13, 12, VGATE ], 'back down the frames to shut')
	t.end()
})

test('a gate that is still sliding open is still solid', function(t) {
	var level = corridor('one', [ F, F, SWITCH ])
	level.tiles[2][3] = VGATE
	level.wiring = [
		{ row: 1, col: 3, channel: 0 },
		{ row: 2, col: 3, channel: 0 }
	]

	var game = createGame([ level ])

	rollUntil(game, 'right', function() { return game.channelOn(0) }, 400)

	game.tick(60)
	t.equal(game.grid[2][3], 12, 'one frame out')
	t.ok(tiles.isWall(game.grid[2][3]), 'and the ball cannot get through it yet')

	game.tick(60)
	t.equal(game.grid[2][3], 13)
	t.ok(tiles.isWall(game.grid[2][3]))

	game.tick(60)
	t.equal(game.grid[2][3], tiles.TILE.VGATE_OPEN, 'now it is open')
	t.notOk(tiles.isWall(game.grid[2][3]), 'and only now can the ball pass')
	t.end()
})

/***** Letters *****/

var LETTER = tiles.TILE.LETTER

test('rolling over a letter collects the note written on it', function(t) {
	var level = corridor('one', [ F, LETTER, F ])
	level.notes = [ { row: 1, col: 2, text: 'Mind the death cubes.' } ]

	var game = createGame([ level ])

	t.deepEqual(game.notes, [], 'nothing collected yet')
	t.equal(game.lastNote, null)

	roll(game, 'right', 200)

	t.deepEqual(game.notes, [ 'Mind the death cubes.' ], 'the note was picked up')
	t.equal(game.lastNote, 'Mind the death cubes.', 'and it is the one to show')
	t.equal(game.grid[1][2], tiles.TILE.FLOOR, 'the letter is gone from the board')
	t.end()
})

test('a letter is only collected once', function(t) {
	var level = corridor('one', [ LETTER, F, F ])
	level.notes = [ { row: 1, col: 1, text: 'Only once.' } ]

	var game = createGame([ level ])

	roll(game, 'right', 40)
	roll(game, 'left', 200)
	roll(game, 'right', 200)

	t.equal(game.notes.length, 1)
	t.end()
})

test('letters are collected in the order they are found', function(t) {
	var level = corridor('one', [ LETTER, F, LETTER, F ])
	level.notes = [
		{ row: 1, col: 1, text: 'First.' },
		{ row: 1, col: 3, text: 'Second.' }
	]

	var game = createGame([ level ])

	roll(game, 'right', 300)

	t.deepEqual(game.notes, [ 'First.', 'Second.' ])
	t.equal(game.lastNote, 'Second.', 'the newest one is the one to show')
	t.end()
})

test('a letter with no note written on it still clears', function(t) {
	var level = corridor('one', [ F, LETTER, F ])

	var game = createGame([ level ])

	roll(game, 'right', 200)

	t.equal(game.grid[1][2], tiles.TILE.FLOOR)
	t.deepEqual(game.notes, [], 'and there is nothing to read')
	t.end()
})

test('restarting a level puts the letters back and forgets the notes', function(t) {
	var level = corridor('one', [ F, LETTER, X ])
	level.notes = [ { row: 1, col: 2, text: 'Turn back.' } ]

	var game = createGame([ level ])

	roll(game, 'right', 300)
	t.equal(game.status, createGame.DEAD)
	t.deepEqual(game.notes, [ 'Turn back.' ])

	game.advance()

	t.equal(game.grid[1][2], LETTER, 'the letter is back on the board')
	t.deepEqual(game.notes, [], 'and the notes are forgotten')
	t.equal(game.lastNote, null)
	t.end()
})

test('a letter is not a wall and not deadly', function(t) {
	t.notOk(tiles.isWall(LETTER))
	t.notOk(tiles.isDeadly(LETTER))
	t.ok(tiles.isLetter(LETTER))
	t.end()
})
