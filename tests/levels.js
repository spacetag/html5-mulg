var test = require('tape')
var levels = require('../levels')
var tiles = require('../tiles')

function forEachLevel(t, check) {
	levels.forEach(function(level, index) {
		check(level, 'level ' + (index + 1) + ' (' + level.name + ')')
	})
}

var OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' }

function isWired(level, row, col) {
	return (level.wiring || []).some(function(wire) {
		return wire.row === row && wire.col === col
	})
}

// A wired gate is a wall now, but a switch somewhere can open it, so the walk
// below is allowed through it.
function canBeOpened(level, row, col) {
	if (!isWired(level, row, col)) return false

	var partner = tiles.activatedPartner(level.tiles[row][col])
	return partner !== null && !tiles.isWall(partner)
}

// Likewise a wired pit: a switch fills it in, so crossing it is not a death.
function canBeFilled(level, row, col) {
	if (!isWired(level, row, col)) return false

	var partner = tiles.activatedPartner(level.tiles[row][col])
	return partner !== null && !tiles.isDeadly(partner)
}

var STEPS = [
	{ row: -1, col: 0, direction: 'up' },
	{ row: 1, col: 0, direction: 'down' },
	{ row: 0, col: -1, direction: 'left' },
	{ row: 0, col: 1, direction: 'right' }
]

// Walks the level from the start square, refusing to step on walls or into a
// one-way arrow from the wrong side, and returns the squares it can get to.
// Deadly squares count as reachable unless `avoidDeadly` is asked for: rolling
// onto one is allowed, it just costs a life.
function reachableFromStart(level, options) {
	var width = level.tiles[0].length
	var height = level.tiles.length
	var seen = {}
	var queue = [ level.start ]

	while (queue.length) {
		var at = queue.shift()
		var key = at.row + ',' + at.col

		if (seen[key]) continue

		seen[key] = at

		STEPS.forEach(function(step) {
			var row = at.row + step.row
			var col = at.col + step.col

			if (row < 0 || col < 0 || row >= height || col >= width) return

			var tile = level.tiles[row][col]
			if (tiles.isWall(tile) && !canBeOpened(level, row, col)) return
			if (tiles.oneWayDirection(tile) === OPPOSITE[step.direction]) return
			if (options && options.avoidDeadly && tiles.isDeadly(tile) && !canBeFilled(level, row, col)) return

			queue.push({ row: row, col: col })
		})
	}

	return seen
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

test('every level has exactly one goal, and it can be reached', function(t) {
	forEachLevel(t, function(level, name) {
		var goals = []

		level.tiles.forEach(function(row, rowIndex) {
			row.forEach(function(tile, colIndex) {
				if (tiles.isGoal(tile)) goals.push({ row: rowIndex, col: colIndex })
			})
		})

		t.equal(goals.length, 1, name + ' has one goal')

		var reachable = reachableFromStart(level)
		t.ok(reachable[goals[0].row + ',' + goals[0].col], name + ' can be finished')
	})

	t.end()
})

// Playing the levels through turned up a pit sitting across the only corridor to
// the exit, which made that level impossible: dying does not get you past it.
test('every level can be finished without dying', function(t) {
	forEachLevel(t, function(level, name) {
		var goal = null

		level.tiles.forEach(function(row, rowIndex) {
			row.forEach(function(tile, colIndex) {
				if (tiles.isGoal(tile)) goal = { row: rowIndex, col: colIndex }
			})
		})

		var safe = reachableFromStart(level, { avoidDeadly: true })

		t.ok(safe[goal.row + ',' + goal.col],
			name + ' has a route to the exit that never crosses a deadly square')
	})

	t.end()
})

test('every coin in a level can be reached', function(t) {
	forEachLevel(t, function(level, name) {
		var reachable = reachableFromStart(level)

		level.tiles.forEach(function(row, rowIndex) {
			row.forEach(function(tile, colIndex) {
				if (!tiles.isCoin(tile)) return
				t.ok(reachable[rowIndex + ',' + colIndex],
					name + ' coin at ' + rowIndex + ',' + colIndex + ' is reachable')
			})
		})
	})

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
