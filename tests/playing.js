var test = require('tape')
var createGame = require('../game')
var levels = require('../levels')
var tiles = require('../tiles')

// tests/levels.js asks whether the board allows a route. This asks the harder
// question: can the marble actually be steered along one? It plans a route, then
// drives it with the same four keys a player has, under the real rules, on one
// life, taking every coin before going anywhere near the exit.
//
// It caught three levels that the reachability walk was happy with and no player
// could ever have cleared: in each, the only way to a coin ran across the exit
// square, which ends the level the moment you touch it.
//
// A level this cannot steer is not automatically a bad level - the driver below
// is a plain proportional controller, not a good player. But a level it cannot
// steer is worth looking at before it ships.

var TILE_SIZE = createGame.TILE_SIZE
var OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' }

var STEPS = [
	{ row: -1, col: 0, direction: 'up' },
	{ row: 1, col: 0, direction: 'down' },
	{ row: 0, col: -1, direction: 'left' },
	{ row: 0, col: 1, direction: 'right' }
]

// How hard the driver is willing to push, how close to the speed it wants is
// close enough, and how much of the distance left it turns into speed.
var MAX_SPEED = 7
var DEADBAND = 0.4
var GAIN = 0.28
var TICKS_PER_SQUARE = 900
// How near the middle of a corridor is near enough to set off along it. The ball
// is round and nearly as wide as a square, so a one-square gap leaves it about a
// third of a square of room either side, and off to one side it catches the
// corner of the wall beside the gap instead of going through.
var LINED_UP = 2

/***** Planning a route over the board *****/

function planner(level) {
	var height = level.tiles.length
	var width = level.tiles[0].length
	var channelAt = {};

	(level.wiring || []).forEach(function(wire) {
		channelAt[wire.row + ',' + wire.col] = wire.channel
	})

	function tileAt(row, col, channels) {
		var base = level.tiles[row][col]
		var channel = channelAt[row + ',' + col]

		if (channel === undefined || (channels & (1 << channel)) === 0) return base

		var forms = tiles.switchForms(base)
		if (forms) return forms.on

		var partner = tiles.activatedPartner(base)
		return partner === null ? base : partner
	}

	// The shortest run of moves from here to any square in `targets`, keeping off
	// the squares in `avoid`. Bumping a switch is a move of its own: it throws a
	// channel and leaves the ball where it stands.
	function routeTo(from, targets, avoid) {
		avoid = avoid || {}

		var seen = {}
		var queue = [ { at: from, moves: [] } ]

		while (queue.length) {
			var node = queue.shift()
			var at = node.at
			var key = at.row + ',' + at.col + ',' + at.channels

			if (seen[key]) continue
			seen[key] = true

			if (targets[at.row + ',' + at.col] && node.moves.length) return node.moves

			// What this square is once the ball is standing on it, which is not
			// what it was on the way in: a momentary plate springs back up as the
			// ball rolls off it, so a pit it was filling opens again and a gate it
			// was holding open comes down, both of them on the ball.
			var here = tileAt(at.row, at.col, at.channels)
			if (tiles.isDeadly(here) || tiles.isClosedGate(here)) continue

			// A floor switch is held down for as long as the ball is on this square.
			var held = at.channels
			var switchHere = tiles.switchForms(here)
			var channelHere = channelAt[at.row + ',' + at.col]

			if (switchHere && switchHere.momentary && channelHere !== undefined) {
				held = held | (1 << channelHere)
			}

			var leaving = tiles.oneWayDirection(here)

			STEPS.forEach(function(step) {
				var row = at.row + step.row
				var col = at.col + step.col

				if (row < 0 || col < 0 || row >= height || col >= width) return
				if (leaving !== null && OPPOSITE[leaving] === step.direction) return

				var tile = tileAt(row, col, held)

				if (tiles.isWall(tile)) {
					var forms = tiles.switchForms(tile)
					var channel = channelAt[row + ',' + col]

					if (forms && !forms.momentary && channel !== undefined) {
						queue.push({
							at: { row: at.row, col: at.col, channels: at.channels ^ (1 << channel) },
							moves: node.moves.concat([
								{ bump: true, direction: step.direction, channel: channel }
							])
						})
					}

					return
				}

				// A one-way admits exactly the one heading it points in, as mulg.c's
				// check_tile does: not just "never against the arrow".
				var arrow = tiles.oneWayDirection(tile)
				if (arrow !== null && arrow !== step.direction) return
				if (avoid[row + ',' + col] && !targets[row + ',' + col]) return

				queue.push({
					at: { row: row, col: col, channels: at.channels },
					moves: node.moves.concat([ { row: row, col: col } ])
				})
			})
		}

		return null
	}

	// Where a run of moves leaves the ball, and which channels it leaves thrown.
	function after(from, moves) {
		var at = { row: from.row, col: from.col, channels: from.channels }

		moves.forEach(function(move) {
			if (move.bump) at.channels = at.channels ^ (1 << move.channel)
			else { at.row = move.row; at.col = move.col }
		})

		return at
	}

	// An order to take the coins in that still leaves the exit reachable, or null
	// if no order does. Grabbing the nearest one first can strand the ball behind
	// a one-way, so the order is worked out on the board before anything is
	// driven.
	function coinOrder(from, coins, exit) {
		function search(at, left) {
			if (!left.length) return routeTo(at, exit) ? [] : null

			for (var i = 0; i < left.length; i++) {
				var target = {}
				target[left[i]] = true

				var moves = routeTo(at, target, exit)
				if (!moves) continue

				var rest = left.slice()
				rest.splice(i, 1)

				var onwards = search(after(at, moves), rest)
				if (onwards) return [ left[i] ].concat(onwards)
			}

			return null
		}

		return search(from, Object.keys(coins))
	}

	return { routeTo: routeTo, coinOrder: coinOrder }
}

/***** Driving it, four keys at a time *****/

function release(game) {
	game.input.left = game.input.right = game.input.up = game.input.down = false
}

// Push towards the speed that would close the gap, and push back when the ball
// is already going faster than that. On ice this is the only way to stop.
//
// `across` is the axis the ball has to be lined up on before it is worth setting
// off, which is the one it is not travelling along. Until it is lined up the ball
// is braked rather than let go of, because letting go of it on ice does nothing.
function steer(game, targetRow, targetCol, across) {
	function axis(back, forward, gap, speed) {
		var want = gap * GAIN

		if (want > MAX_SPEED) want = MAX_SPEED
		if (want < -MAX_SPEED) want = -MAX_SPEED

		game.input[back] = speed > want + DEADBAND
		game.input[forward] = speed < want - DEADBAND
	}

	var downGap = targetRow * TILE_SIZE - game.ball.y
	var rightGap = targetCol * TILE_SIZE - game.ball.x

	if (across === 'x' && Math.abs(rightGap) > LINED_UP) downGap = 0
	if (across === 'y' && Math.abs(downGap) > LINED_UP) rightGap = 0

	axis('left', 'right', rightGap, game.ball.sx)
	axis('up', 'down', downGap, game.ball.sy)
}

function outcome(game) {
	if (game.status === createGame.LEVEL_WON || game.status === createGame.GAME_WON) return 'won'
	return 'died'
}

// The far end of the straight run the ball is setting off on. Aiming at the next
// square along means braking to a standstill in every square on the way, and a
// gate shuts in about the time it takes to cross its own square at a fair clip,
// so a ball that stops that often can never get through one. Aiming at the end of
// the run instead keeps it rolling, which is what a player does.
function runEnd(from, moves, i) {
	var last = i
	var downStep = moves[i].row - from.row
	var rightStep = moves[i].col - from.col

	while (last + 1 < moves.length && !moves[last + 1].bump &&
		moves[last + 1].row - moves[last].row === downStep &&
		moves[last + 1].col - moves[last].col === rightStep) last++

	return moves[last]
}

function rollTo(game, moves, index) {
	var move = moves[index]
	var from = game.ballSquare()
	var aim = runEnd(from, moves, index)
	// Rolling along a row, it is the column the ball has to be lined up on, and
	// the other way about.
	var across = move.row === from.row ? 'y' : 'x'

	for (var i = 0; i < TICKS_PER_SQUARE; i++) {
		steer(game, aim.row, aim.col, across)
		game.tick(16)

		if (game.status !== createGame.PLAYING) { release(game); return outcome(game) }

		var at = game.ballSquare()
		if (at.row === move.row && at.col === move.col) { release(game); return 'ok' }
	}

	release(game)
	return 'stuck'
}

// A switch the ball cannot roll over has no square to arrive at, only a channel
// that changes, so lean on it until it does.
function bump(game, move) {
	var before = game.channelOn(move.channel)

	for (var i = 0; i < TICKS_PER_SQUARE; i++) {
		release(game)
		game.input[move.direction] = true
		game.tick(16)

		if (game.status !== createGame.PLAYING) { release(game); return outcome(game) }
		if (game.channelOn(move.channel) !== before) { release(game); return 'ok' }
	}

	release(game)
	return 'stuck'
}

/***** One level, start to finish *****/

function play(level) {
	var game = createGame([ level ], { lives: 1 })
	var plan = planner(level)
	var coins = {}
	var exit = {}

	level.tiles.forEach(function(row, rowIndex) {
		row.forEach(function(tile, colIndex) {
			if (tiles.isCoin(tile)) coins[rowIndex + ',' + colIndex] = true
			if (tiles.isGoal(tile)) exit[rowIndex + ',' + colIndex] = true
		})
	})

	function channels() {
		var bits = 0
		for (var i = 0; i < tiles.CHANNELS; i++) if (game.channelOn(i)) bits = bits | (1 << i)
		return bits
	}

	function where() {
		var at = game.ballSquare()
		return { row: at.row, col: at.col, channels: channels() }
	}

	// Replanned from where the ball actually ended up, not from where the plan
	// thought it would be.
	function leg(targets, what, avoid) {
		var moves = plan.routeTo(where(), targets, avoid)
		if (!moves) return 'no way from ' + game.ballSquare().row + ',' + game.ballSquare().col + ' to ' + what

		for (var i = 0; i < moves.length; i++) {
			var move = moves[i]
			var result = move.bump ? bump(game, move) : rollTo(game, moves, i)

			if (result === 'ok') continue
			if (result === 'won') return what === 'the exit' ? null : 'rolled onto the exit on the way to ' + what
			if (result === 'stuck') return 'could not be steered to ' + move.row + ',' + move.col + ' on the way to ' + what
			return 'died on the way to ' + what
		}

		return null
	}

	var order = plan.coinOrder(where(), coins, exit)
	if (!order) return 'no order takes every coin and still leaves the exit reachable'

	for (var i = 0; i < order.length; i++) {
		var problem = leg(pick(order[i]), 'the coin at ' + order[i], exit)
		if (problem) return problem
	}

	var last = leg(exit, 'the exit')
	if (last) return last

	return null
}

function pick(key) {
	var one = {}
	one[key] = true
	return one
}

test('every level can be played through: all the coins, then the exit, on one life', function(t) {
	levels.forEach(function(level, index) {
		var name = 'level ' + (index + 1) + ' (' + level.name + ')'
		t.equal(play(level), null, name + ' can be played through')
	})

	t.end()
})
