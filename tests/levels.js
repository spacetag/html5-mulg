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

// Walks the level from the start square, refusing to step on walls or into a
// one-way arrow from the wrong side, and returns the squares it can get to.
// Deadly squares are reachable on purpose: they are passable, they just cost you
// a life.
function reachableFromStart(level) {
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
			if (tiles.isWall(tile)) return
			if (tiles.oneWayDirection(tile) === OPPOSITE[step.direction]) return

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
