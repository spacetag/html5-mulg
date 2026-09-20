var test = require('tape')
var levels = require('../levels')
var tiles = require('../tiles')

function forEachLevel(t, check) {
	levels.forEach(function(level, index) {
		check(level, 'level ' + (index + 1) + ' (' + level.name + ')')
	})
}

var OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' }

var STEPS = [
	{ row: -1, col: 0, direction: 'up' },
	{ row: 1, col: 0, direction: 'down' },
	{ row: 0, col: -1, direction: 'left' },
	{ row: 0, col: 1, direction: 'right' }
]

// Walks the level from the start square as a search over (square, channel
// state), and reports the squares the ball can get to and whether the goal is
// one of them. It refuses to step on walls, into a one-way arrow from the wrong
// side, or through anything deadly.
//
// Channel state has to be part of the walk rather than a property of a square.
// A wired gate opens and a wired pit fills in, but only once a switch on that
// channel has been reached and thrown, and a switch can perfectly well be
// stranded behind the very thing it clears. Bumping a switch the ball cannot
// roll over flips its channel and leaves the ball where it is, which is what the
// rules do. A floor button throws its channel when the ball rolls onto it and
// stays thrown, and throwing it spends it until another button on the same
// channel is worked.
//
// This is what the board allows, not whether the marble can be steered along it;
// tests/game.js plays the rules themselves.
function explore(level) {
	var height = level.tiles.length
	var width = level.tiles[0].length
	var channelAt = {}
	// Floor buttons carry their own armed-or-spent state, so they are tracked by
	// index in a second bitmask alongside the channels.
	var buttons = []
	var buttonAt = {};

	(level.wiring || []).forEach(function(wire) {
		channelAt[wire.row + ',' + wire.col] = wire.channel

		var forms = tiles.switchForms(level.tiles[wire.row][wire.col])

		if (forms && forms.thrownBy === tiles.ROLLED_ONTO) {
			buttonAt[wire.row + ',' + wire.col] = buttons.length
			buttons.push({ row: wire.row, col: wire.col, channel: wire.channel, forms: forms })
		}
	})

	// What a square shows with these channels thrown and these buttons spent.
	function tileAt(row, col, channels, spent) {
		var base = level.tiles[row][col]
		var button = buttonAt[row + ',' + col]

		if (button !== undefined) return (spent & (1 << button)) ? buttons[button].forms.on : base

		var channel = channelAt[row + ',' + col]

		if (channel === undefined || (channels & (1 << channel)) === 0) return base

		var forms = tiles.switchForms(base)
		if (forms) return forms.on

		var partner = tiles.activatedPartner(base)
		return partner === null ? base : partner
	}

	// Rolling onto an armed button throws its channel, spends it, and re-arms
	// every other button on that channel.
	function afterRollingOnto(at) {
		var button = buttonAt[at.row + ',' + at.col]

		if (button === undefined || (at.spent & (1 << button))) return at

		var spent = at.spent

		buttons.forEach(function(other, index) {
			if (other.channel !== buttons[button].channel) return
			spent = index === button ? (spent | (1 << index)) : (spent & ~(1 << index))
		})

		return {
			row: at.row,
			col: at.col,
			channels: at.channels ^ (1 << buttons[button].channel),
			spent: spent
		}
	}

	var squares = {}
	var seen = {}
	var queue = [ { row: level.start.row, col: level.start.col, channels: 0, spent: 0 } ]
	var finished = false

	while (queue.length) {
		var at = queue.shift()
		var key = at.row + ',' + at.col + ',' + at.channels + ',' + at.spent

		if (seen[key]) continue

		seen[key] = true
		squares[at.row + ',' + at.col] = true

		var here = tileAt(at.row, at.col, at.channels, at.spent)

		if (tiles.isGoal(here)) finished = true
		// Rolling onto a pit or a death cube is where the ball's journey ends.
		if (tiles.isDeadly(here)) continue

		// Arriving here may have thrown a button, which stays thrown.
		at = afterRollingOnto(at)
		var held = at.channels


		STEPS.forEach(function(step) {
			var row = at.row + step.row
			var col = at.col + step.col

			if (row < 0 || col < 0 || row >= height || col >= width) return
			var tile = tileAt(row, col, held, at.spent)

			if (tiles.isWall(tile)) {
				var forms = tiles.switchForms(tile)
				var channel = channelAt[row + ',' + col]

				// Bumping a switch throws it, and the ball stays where it is.
				if (forms && forms.thrownBy === tiles.BUMPED && channel !== undefined) {
					queue.push({
						row: at.row,
						col: at.col,
						channels: at.channels ^ (1 << channel),
						spent: at.spent
					})
				}

				return
			}

			// A one-way admits only a ball travelling the way it points.
			var into = tiles.oneWayDirection(tile)
			if (into !== null && into !== step.direction) return

			queue.push({ row: row, col: col, channels: at.channels, spent: at.spent })
		})
	}

	return { squares: squares, finished: finished }
}


test('there is at least one level', function(t) {
	t.ok(levels.length > 0)
	t.end()
})

test('every level is rectangular', function(t) {
	forEachLevel(t, function(level, name) {
		var width = level.tiles[0].length

		level.tiles.forEach(function(row, index) {
			t.equal(row.length, width, name + ' row ' + index + ' is the full width')
		})
	})

	t.end()
})

test('every level starts the ball on a square it can sit on', function(t) {
	forEachLevel(t, function(level, name) {
		var startTile = level.tiles[level.start.row][level.start.col]

		t.notOk(tiles.isWall(startTile), name + ' does not start inside a wall')
		t.notOk(tiles.isDeadly(startTile), name + ' does not start on something deadly')
		t.notOk(tiles.isGoal(startTile), name + ' does not start on the goal')
	})

	t.end()
})

test('every level has exactly one goal', function(t) {
	forEachLevel(t, function(level, name) {
		var goals = []

		level.tiles.forEach(function(row, rowIndex) {
			row.forEach(function(tile, colIndex) {
				if (tiles.isGoal(tile)) goals.push({ row: rowIndex, col: colIndex })
			})
		})

		t.equal(goals.length, 1, name + ' has one goal')
	})

	t.end()
})

// Playing the levels through turned up a pit sitting across the only corridor to
// the exit, which made that level impossible: dying does not get you past it.
test('every level can be finished without dying', function(t) {
	forEachLevel(t, function(level, name) {
		t.ok(explore(level).finished,
			name + ' has a route to the exit that never crosses a deadly square')
	})

	t.end()
})

// A coin behind a death cube is not a risk the player can take: dying restarts
// the level, so it can never be collected at all.
test('every coin in a level can be collected without dying', function(t) {
	forEachLevel(t, function(level, name) {
		var safe = explore(level).squares

		level.tiles.forEach(function(row, rowIndex) {
			row.forEach(function(tile, colIndex) {
				if (!tiles.isCoin(tile)) return
				t.ok(safe[rowIndex + ',' + colIndex],
					name + ' coin at ' + rowIndex + ',' + colIndex + ' can be collected')
			})
		})
	})

	t.end()
})

// The two tests above are only worth their salt if the walk really refuses to
// cross a pit, and really insists on reaching a switch before crediting what it
// opens. A pit wired to a switch you can only get at from the far side clears
// nothing.
test('a pit across the only corridor is a wall, not a toll', function(t) {
	var W = tiles.TILE.BLOCK
	var F = tiles.TILE.FLOOR
	var G = tiles.TILE.TARGET_CROSS
	var P = tiles.TILE.EMPTY_PIT
	var S = tiles.TILE.SWITCH_LOW

	t.notOk(explore({
		name: 'unwired',
		start: { row: 1, col: 1 },
		tiles: [
			[ W, W, W, W, W ],
			[ W, F, P, G, W ],
			[ W, W, W, W, W ]
		]
	}).finished, 'a goal only reachable through a pit cannot be reached')

	t.ok(explore({
		name: 'wired',
		start: { row: 1, col: 1 },
		tiles: [
			[ W, W, W, W, W ],
			[ W, F, P, G, W ],
			[ W, S, W, W, W ]
		],
		wiring: [
			{ row: 2, col: 1, channel: 0 },
			{ row: 1, col: 2, channel: 0 }
		]
	}).finished, 'a switch on the near side fills the pit in and opens the way')

	t.notOk(explore({
		name: 'stranded',
		start: { row: 1, col: 1 },
		tiles: [
			[ W, W, W, W, W ],
			[ W, F, P, G, W ],
			[ W, W, W, S, W ]
		],
		wiring: [
			{ row: 2, col: 3, channel: 0 },
			{ row: 1, col: 2, channel: 0 }
		]
	}).finished, 'a switch behind the pit cannot be reached to throw')

	t.end()
})

test('every wired square is something a channel can act on', function(t) {
	forEachLevel(t, function(level, name) {
		(level.wiring || []).forEach(function(wire) {
			var where = name + ' at ' + wire.row + ',' + wire.col

			t.ok(wire.channel >= 0 && wire.channel < tiles.CHANNELS, where + ' has a channel in range')

			var tile = level.tiles[wire.row][wire.col]
			var usable = tiles.switchForms(tile) !== null || tiles.activatedPartner(tile) !== null

			t.ok(usable, where + ' is a switch or something switchable')
		})
	})

	t.end()
})

test('every channel has both a switch and something to switch', function(t) {
	forEachLevel(t, function(level, name) {
		var byChannel = {};

		(level.wiring || []).forEach(function(wire) {
			var tile = level.tiles[wire.row][wire.col]
			byChannel[wire.channel] = byChannel[wire.channel] || { switches: 0, activated: 0 }

			if (tiles.switchForms(tile)) byChannel[wire.channel].switches++
			else byChannel[wire.channel].activated++
		})

		Object.keys(byChannel).forEach(function(channel) {
			t.ok(byChannel[channel].switches > 0, name + ' channel ' + channel + ' has a switch')
			t.ok(byChannel[channel].activated > 0, name + ' channel ' + channel + ' has something to switch')
		})
	})

	t.end()
})

test('levels are walled in, so the ball cannot wrap off the edge', function(t) {
	forEachLevel(t, function(level, name) {
		var lastRow = level.tiles.length - 1
		var lastCol = level.tiles[0].length - 1
		var edgesAreWalls = true

		level.tiles.forEach(function(row, rowIndex) {
			row.forEach(function(tile, colIndex) {
				var onEdge = rowIndex === 0 || colIndex === 0 ||
					rowIndex === lastRow || colIndex === lastCol
				if (onEdge && !tiles.isWall(tile)) edgesAreWalls = false
			})
		})

		t.ok(edgesAreWalls, name + ' is walled in')
	})

	t.end()
})
