var test = require('tape')
var tiles = require('../tiles')

test('the green block is a wall, plain floor is not', function(t) {
	t.ok(tiles.isWall(tiles.TILE.WALL))
	t.notOk(tiles.isWall(tiles.TILE.FLOOR))
	t.end()
})

test('unclassified tiles are scenery the ball rolls over', function(t) {
	t.equal(tiles.tileInfo(60).kind, tiles.FLOOR)
	t.notOk(tiles.isWall(60))
	t.notOk(tiles.isDeadly(60))
	t.end()
})

test('goal, deadly and coin tiles are recognised', function(t) {
	t.ok(tiles.isGoal(tiles.TILE.GOAL))
	t.ok(tiles.isDeadly(tiles.TILE.SKULL))
	t.ok(tiles.isDeadly(tiles.TILE.WATER))
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
	var kindChecks = [ tiles.isWall, tiles.isGoal, tiles.isDeadly, tiles.isCoin ]

	for (var tileNumber = 0; tileNumber < 147; tileNumber++) {
		var matches = kindChecks.filter(function(check) {
			return check(tileNumber)
		})

		t.ok(matches.length <= 1, 'tile ' + tileNumber + ' has one kind at most')
	}

	t.end()
})
