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
