var test = require('tape')
var tiles = require('../tiles')

test('the green block is a wall, plain floor is not', function(t) {
	t.ok(tiles.isWall(tiles.TILE.BLOCK))
	t.notOk(tiles.isWall(tiles.TILE.FLOOR))
	t.end()
})

test('the goal is the target cross, not the lock', function(t) {
	t.ok(tiles.isGoal(tiles.TILE.TARGET_CROSS), 'tile 5 is the exit')
	t.notOk(tiles.isGoal(37), 'tile 37 is a lock, not the exit')
	t.end()
})

test('an empty pit is deadly and mud is not a wall', function(t) {
	t.ok(tiles.isDeadly(tiles.TILE.EMPTY_PIT))
	t.notOk(tiles.isWall(tiles.TILE.MUD), 'mud slows the ball, it does not stop it')
	t.notOk(tiles.isDeadly(113), 'tile 113 is a light box, not water')
	t.end()
})

test('surfaces change how the ball keeps its speed', function(t) {
	t.deepEqual(tiles.surface(tiles.TILE.FLOOR), tiles.FLOOR_SURFACE, 'floor is the default')
	t.equal(tiles.surface(tiles.TILE.ICY_FLOOR).decayOff, 1, 'ice does not slow the ball')
	t.ok(tiles.surface(tiles.TILE.MUD).decayOff < tiles.FLOOR_SURFACE.decayOff, 'mud slows it harder than floor')
	t.ok(tiles.surface(tiles.TILE.OIL).control < 1, 'oil leaves the player little steering')
	t.end()
})

test('one-way tiles know which way they let the ball through', function(t) {
	t.equal(tiles.oneWayDirection(tiles.TILE.ONE_WAY_LEFT), 'left')
	t.equal(tiles.oneWayDirection(tiles.TILE.ONE_WAY_RIGHT), 'right')
	t.equal(tiles.oneWayDirection(tiles.TILE.ONE_WAY_UP), 'up')
	t.equal(tiles.oneWayDirection(tiles.TILE.ONE_WAY_DOWN), 'down')
	t.equal(tiles.oneWayDirection(tiles.TILE.FLOOR), null)
	t.end()
})

test('unclassified tiles are scenery the ball rolls over', function(t) {
	t.equal(tiles.tileInfo(60).kind, tiles.FLOOR)
	t.notOk(tiles.isWall(60))
	t.notOk(tiles.isDeadly(60))
	t.end()
})

test('goal, deadly and coin tiles are recognised', function(t) {
	t.ok(tiles.isGoal(tiles.TILE.TARGET_CROSS))
	t.ok(tiles.isDeadly(tiles.TILE.DEATH_CUBE))
	t.ok(tiles.isCoin(tiles.TILE.COIN_1))
	t.end()
})

test('coins carry their value, everything else is worth nothing', function(t) {
	t.equal(tiles.coinValue(tiles.TILE.COIN_1), 1)
	t.equal(tiles.coinValue(tiles.TILE.COIN_5), 5)
	t.equal(tiles.coinValue(tiles.TILE.FLOOR), 0)
	t.end()
})

test('a tile has exactly one kind', function(t) {
	var kindChecks = [ tiles.isWall, tiles.isGoal, tiles.isDeadly, tiles.isCoin, function(tile) {
		return tiles.oneWayDirection(tile) !== null
	} ]

	for (var tileNumber = 0; tileNumber < 147; tileNumber++) {
		var matches = kindChecks.filter(function(check) {
			return check(tileNumber)
		})

		t.ok(matches.length <= 1, 'tile ' + tileNumber + ' has one kind at most')
	}

	t.end()
})

// The eight headings a ball can roll into a square from, as mulg.c's check_tile
// numbers them: the four axes are its dir 1/5/7/3 and the four diagonals its
// 2/4/6/8. Driven tests can only reach the axes, because the corner probe finds a
// wall before the arrow in every level we have, so the diagonals are checked here.
var HEADINGS = {
	left: { x: -1, y: 0 },
	right: { x: 1, y: 0 },
	up: { x: 0, y: -1 },
	down: { x: 0, y: 1 },
	'up-left': { x: -1, y: -1 },
	'up-right': { x: 1, y: -1 },
	'down-left': { x: -1, y: 1 },
	'down-right': { x: 1, y: 1 }
}

test('a one-way admits the heading it points in and nothing else', function(t) {
	var arrows = {
		left: tiles.TILE.ONE_WAY_LEFT,
		right: tiles.TILE.ONE_WAY_RIGHT,
		up: tiles.TILE.ONE_WAY_UP,
		down: tiles.TILE.ONE_WAY_DOWN
	}

	Object.keys(arrows).forEach(function(arrow) {
		var tile = arrows[arrow]

		Object.keys(HEADINGS).forEach(function(heading) {
			var admitted = tiles.oneWayAdmits(tile, HEADINGS[heading])
			var what = 'a ' + arrow + ' arrow, entered ' + heading

			if (heading === arrow) t.ok(admitted, what + ', lets the ball in')
			else t.notOk(admitted, what + ', turns the ball away')
		})
	})

	t.end()
})

test('a one-way does not restrain the ball already on it', function(t) {
	// mulg.c's dir 0: the ball overlaps the square rather than rolling into it.
	t.ok(tiles.oneWayAdmits(tiles.TILE.ONE_WAY_RIGHT, null), 'an arrow lets it be')
	t.ok(tiles.oneWayAdmits(tiles.TILE.ONE_WAY_UP, undefined), 'whichever way it came')
	t.end()
})

test('a square that is not an arrow admits every heading', function(t) {
	Object.keys(HEADINGS).forEach(function(heading) {
		t.ok(tiles.oneWayAdmits(tiles.TILE.FLOOR, HEADINGS[heading]), 'floor, entered ' + heading)
	})

	t.end()
})
