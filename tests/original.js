var test = require('tape')
var fs = require('fs')
var path = require('path')

var tiles = require('../tiles')
var play = require('./helpers/play')
var converter = require('../tools/convert-levels')
var sets = require('../levels-original')

// levels-original.js is generated from the level databases in levels/original/,
// so these tests ask two things of it: that it still is what the converter makes
// of those files, and that the levels it produces are levels this game can hold.

var LEVEL_DIR = path.join(__dirname, '..', 'levels', 'original')

// Levels that use only mechanics the port has implemented, and still do not come
// out of tests/helpers/play.js. Neither is a conversion fault, and both are here
// by name rather than skipped quietly.
var NOT_DRIVEN = {
    // A one-square-wide spiral with a pit either side of it the whole way. The
    // driver is a proportional controller, not a player: it overshoots a corner
    // and falls in.
    "Round'n Round": 'the test driver cannot steer the spiral',

    // Built entirely on floor buttons. mulg.c works a button when the marble
    // rolls onto it (case BUT0 -> switch_it), which toggles the channel and
    // leaves it toggled; this port holds the channel on only while the marble
    // stays on the square. The planner models neither, so it finds no route.
    'Watch your step!': 'floor buttons toggle in the original and are held here'
}

test('the checked-in levels are what the converter makes of the databases now', function(t) {
    var files = fs.readdirSync(LEVEL_DIR).filter(function(name) {
        return /\.pdb$/i.test(name)
    }).sort()

    t.equal(files.length, sets.length, 'a set per database')

    files.forEach(function(file, index) {
        var fresh = converter.convertDatabase(path.join(LEVEL_DIR, file))
        var checkedIn = sets[index]

        t.equal(checkedIn.source, file, file + ' is the source of set ' + (index + 1))
        t.equal(checkedIn.name, fresh.name, fresh.name + ' keeps its name')
        t.equal(checkedIn.author, fresh.author, fresh.name + ' keeps its author')
        t.equal(checkedIn.levels.length, fresh.levels.length, fresh.name + ' keeps its level count')

        fresh.levels.forEach(function(entry, levelIndex) {
            var expected = entry.level
            var actual = checkedIn.levels[levelIndex]
            var where = fresh.name + ' ' + (levelIndex + 1) + '. ' + expected.name

            expected.needs = entry.needs.length ? entry.needs : undefined

            t.deepEqual({
                name: actual.name,
                needs: actual.needs,
                start: actual.start,
                tiles: actual.tiles,
                wiring: actual.wiring,
                notes: actual.notes
            }, {
                name: expected.name,
                needs: expected.needs,
                start: expected.start,
                tiles: expected.tiles,
                wiring: expected.wiring,
                notes: expected.notes
            }, where + ' converts to what is checked in')
        })
    })

    t.end()
})

test('every converted level is a level this game can hold', function(t) {
    sets.forEach(function(set) {
        set.levels.forEach(function(level, index) {
            var where = set.name + ' ' + (index + 1) + '. ' + level.name
            var width = level.tiles[0].length
            var exits = 0

            t.ok(level.name.length, where + ' has a name')
            t.ok(width > 0 && level.tiles.length > 0, where + ' has a board')

            level.tiles.forEach(function(row) {
                t.equal(row.length, width, where + ' is rectangular')

                row.forEach(function(tile) {
                    if (tiles.isGoal(tile)) exits++
                })
            })

            t.equal(exits, 1, where + ' has one exit');

            // The original allowed up to 37x33, and a screen is 9x8 overlapping
            // by one, so this is the largest a level can be.
            t.ok(width <= 37 && level.tiles.length <= 33, where + ' fits the original bounds')

            var start = level.start
            t.ok(start && level.tiles[start.row] !== undefined &&
                level.tiles[start.row][start.col] === tiles.TILE.FLOOR,
                where + ' starts the marble on a floor square');

            (level.wiring || []).forEach(function(wire) {
                var tile = level.tiles[wire.row] && level.tiles[wire.row][wire.col]

                t.ok(wire.channel >= 0 && wire.channel < tiles.CHANNELS,
                    where + ' wires ' + wire.row + ',' + wire.col + ' to a real channel')
                t.ok(tiles.switchForms(tile) !== null || tiles.activatedPartner(tile) !== null ||
                    converter.IMPLEMENTED.indexOf(tile) === -1,
                    where + ' wires ' + wire.row + ',' + wire.col + ' to a tile that can be wired')
            });

            (level.notes || []).forEach(function(letter) {
                t.equal(level.tiles[letter.row][letter.col], tiles.TILE.LETTER,
                    where + ' puts its note on a letter')
                t.ok(letter.text.length, where + ' has text for that letter')
            })
        })
    })

    t.end()
})

test('every original level the port fully supports can be played through', function(t) {
    var supported = 0

    sets.forEach(function(set) {
        set.levels.forEach(function(level, index) {
            if (level.needs) return

            supported++

            var where = set.name + ' ' + (index + 1) + '. ' + level.name
            var known = NOT_DRIVEN[level.name]
            var result = play(level)

            if (known) {
                t.ok(result, where + ' is still not driveable: ' + known)
                return
            }

            t.equal(result, null, where + ' can be played through')
        })
    })

    t.ok(supported > 0, 'some original levels need nothing the port has not built')
    t.end()
})
