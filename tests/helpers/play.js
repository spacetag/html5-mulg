// Driving a level the way a player would, so a test can ask whether a level is
// actually winnable rather than merely connected. tests/playing.js runs this
// over levels.js and tests/original.js over the converted originals.
//
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

var createGame = require('../../game')
var tiles = require('../../tiles')

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

			var here = tileAt(at.row, at.col, at.channels)
			if (tiles.isDeadly(here)) continue

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

				if (tiles.oneWayDirection(tile) === OPPOSITE[step.direction]) return
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
function steer(game, targetRow, targetCol) {
	function axis(back, forward, gap, speed) {
		var want = gap * GAIN

		if (want > MAX_SPEED) want = MAX_SPEED
		if (want < -MAX_SPEED) want = -MAX_SPEED

		game.input[back] = speed > want + DEADBAND
		game.input[forward] = speed < want - DEADBAND
	}

	axis('left', 'right', targetCol * TILE_SIZE - game.ball.x, game.ball.sx)
	axis('up', 'down', targetRow * TILE_SIZE - game.ball.y, game.ball.sy)
}

function outcome(game) {
	if (game.status === createGame.LEVEL_WON || game.status === createGame.GAME_WON) return 'won'
	return 'died'
}

function rollTo(game, move) {
	for (var i = 0; i < TICKS_PER_SQUARE; i++) {
		steer(game, move.row, move.col)
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
			var result = move.bump ? bump(game, move) : rollTo(game, move)

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

module.exports = play
