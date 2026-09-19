var test = require('tape')
var levels = require('../levels')
var play = require('./helpers/play')

test('every level can be played through: all the coins, then the exit, on one life', function(t) {
	levels.forEach(function(level, index) {
		var name = 'level ' + (index + 1) + ' (' + level.name + ')'
		t.equal(play(level), null, name + ' can be played through')
	})

	t.end()
})
