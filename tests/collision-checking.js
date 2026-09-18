var test = require('tape')
var collisionChecker = require('../collision-checking')

test('no collision on non-6 tiles', function(t) {
	var level = [
		[0, 0],
		[0, 0]
	]

	var checkForCollision = collisionChecker(level)

	t.notOk(checkForCollision(0, 0))
	t.notOk(checkForCollision(1, 1))

	t.end()
})

test('collision on 6 tiles', function(t) {
	var level = [
		[0, 0],
		[0, 6]
	]

	var checkForCollision = collisionChecker(level)

	t.notOk(checkForCollision(0, 0))
	t.ok(checkForCollision(1, 1))

	t.end()
})

test('a predicate can decide what blocks the ball', function(t) {
	var level = [
		[0, 1],
		[2, 3]
	]

	var checkForCollision = collisionChecker(level, function(tile) {
		return tile % 2 === 1
	})

	t.notOk(checkForCollision(0, 0))
	t.ok(checkForCollision(0, 1))
	t.notOk(checkForCollision(1, 0))
	t.ok(checkForCollision(1, 1))

	t.end()
})

test('lookups wrap around the level edges', function(t) {
	var level = [
		[0, 6],
		[0, 0]
	]

	var checkForCollision = collisionChecker(level)

	t.ok(checkForCollision(0, -1), 'column -1 wraps to the last column')
	t.ok(checkForCollision(2, 1), 'row 2 wraps to row 0')

	t.end()
})
