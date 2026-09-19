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

test('a descending floor wears down to an open pit', function(t) {
	t.equal(tiles.wornBy(tiles.TILE.DESCENDING_FLOOR), 86)
	t.equal(tiles.wornBy(86), 87)
	t.equal(tiles.wornBy(87), tiles.TILE.EMPTY_PIT, 'the last crossing leaves a pit')
	t.end()
})

test('a descending floor is not deadly until it has given way', function(t) {
	t.notOk(tiles.isDeadly(tiles.TILE.DESCENDING_FLOOR))
	t.notOk(tiles.isDeadly(86))
	t.notOk(tiles.isDeadly(87), 'the original turns 87 into a pit rather than killing on it')
	t.ok(tiles.isDeadly(tiles.wornBy(87)))
	t.end()
})

test('an ordinary square is not worn by being crossed', function(t) {
	t.equal(tiles.wornBy(tiles.TILE.FLOOR), null)
	t.equal(tiles.wornBy(tiles.TILE.ICY_FLOOR), null)
	t.equal(tiles.wornBy(tiles.TILE.BLOCK), null)
	t.end()
})
