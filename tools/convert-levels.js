// Turning the original Mulg level databases into levels this port can load.
//
//   node tools/convert-levels.js
//
// reads every .pdb under levels/original/ and writes levels-original.js, then
// prints a report of what each level needs that the port has not implemented.
//
// The conversion is deliberately dumb: the original's tile numbers are the same
// numbers this port uses (docs/original-tiles.md is the same table), so a cell's
// tile byte is copied straight across. The work is all in the second byte, the
// attribute, which the original overloads - it is a channel on the tiles that
// can be wired, the note number on a letter, the tile underneath a box, and a
// handful of flags on plain floor.

var fs = require('fs')
var path = require('path')
var pdb = require('./mulg-pdb')

var ROOT = path.join(__dirname, '..')
var LEVEL_DIR = path.join(ROOT, 'levels', 'original')
var OUT = path.join(ROOT, 'levels-original.js')

/***** What the attribute byte means *****/

var CHANNEL_MASK = 0x1f     // ID_MASK in mulg.c: 32 channels, 0 meaning unwired
// Bit 0x80 marks a tile stored in its switched state. Nothing to do with it
// here: the grid already carries the open form of the tile, which is what the
// game draws and what wireUp() in game.js treats as the level's starting form.

// Tiles whose attribute is a channel. Taken from MulgEd's CellType table
// (CT_CONNECTABLE) plus the gate frames, which mulg.c's switch_it() also walks.
var CONNECTABLE = [
    0x03,                                       // empty pit
    0x04,                                       // floor, which drops away
    0x09, 0x0a,                                 // switch
    0x0b, 0x0c, 0x0d, 0x0e,                     // vertical gate, shut to open
    0x0f, 0x10, 0x11, 0x12,                     // horizontal gate, shut to open
    0x17, 0x18, 0x19, 0x1a,                     // ventilator
    0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x22,         // dice
    0x25,                                       // lock
    0x58, 0x59,                                 // floor switch
    0x66,                                       // coin slot
    0x77,                                       // switch pit
    0x85, 0x88, 0x89, 0x8a                      // Hanoi pieces
]

// Tiles whose attribute is the tile lying underneath them, not a channel.
var CARRIES_TILE_BELOW = [
    0x26,                                       // heavy box
    0x71,                                       // light box
    0x78, 0x79, 0x7a, 0x7b,                     // scarab beetles
    0x8c, 0x8d, 0x8e, 0x8f                      // walkers
]

var LETTER = 0x07
var FLOOR = 0x04

// Flags the original hangs on an otherwise ordinary tile. level.h names them.
var FLOOR_FLAGS = {
    0xff: null,                 // the starting point, which is not a mechanic
    // A floor marked to vanish is not the same square as tile 85. mulg.c:1747
    // counts the tile number up and catches it twice, so a marked floor spends
    // its first crossing turning into 85 and lasts four crossings where 85
    // lasts three. They are named apart here so that implementing one does not
    // look like implementing the other.
    0x20: 'vanishing floor',
    0x40: 'un-reverser',
    0x80: 'reverser'
}

var ICE = 0x2b
var BOX_IN_PLACE = 0x27
var SWITCH_LOW = 0x09
var GAME_OF_LIFE = 0xff         // a switch with this attribute starts Game of Life

/***** What this port implements *****/

// Every tile the game does something with. tiles.js treats anything else as
// floor the ball rolls over, or - for the solid ones - as a plain wall, so a
// level built on one of those is not the level the original shipped.
var IMPLEMENTED = [
    0x03,                       // empty pit
    0x04,                       // floor
    0x05,                       // target cross, the exit
    0x06,                       // block
    0x07,                       // letter
    0x09, 0x0a,                 // switch
    0x0b, 0x0c, 0x0d, 0x0e,     // vertical gate
    0x0f, 0x10, 0x11, 0x12,     // horizontal gate
    0x2a,                       // death cube
    0x2b,                       // icy floor
    0x2c, 0x2d, 0x2e, 0x2f,     // one-ways
    0x58, 0x59,                 // floor switch
    0x62, 0x64,                 // coins
    0x6f,                       // oil
    0x70                        // mud
]

// What an unimplemented tile is called, so the report names a mechanic rather
// than a number. The names come from MulgEd's tile help, the same source as
// docs/original-tiles.md.
var MECHANICS = [
    { name: 'swing', tiles: [ 0x13, 0x14, 0x15, 0x16 ] },
    { name: 'ventilator', tiles: [ 0x17, 0x18, 0x19, 0x1a ] },
    { name: 'hole', tiles: [ 0x1b ] },
    { name: 'bump', tiles: [ 0x1c ] },
    { name: 'dice', tiles: [ 0x1d, 0x1e, 0x1f, 0x20, 0x21, 0x22 ] },
    { name: 'keys and locks', tiles: [ 0x23, 0x24, 0x25 ] },
    { name: 'boxes', tiles: [ 0x26, 0x27, 0x71, 0x72, 0x73, 0x74, 0x75, 0x76 ] },
    { name: 'bouncer', tiles: [ 0x28, 0x29 ] },
    { name: 'bombs', tiles: [ 0x30, 0x31, 0x32, 0x5c, 0x5d ] },
    { name: 'matches', tiles: [ 0x33, 0x34 ] },
    { name: 'grooves', tiles: range(0x35, 0x44) },
    { name: 'ramparts', tiles: range(0x45, 0x54) },
    { name: 'descending floor', tiles: [ 0x55, 0x56, 0x57 ] },
    { name: 'flip tiles', tiles: [ 0x5a, 0x5b ] },
    { name: 'smiley', tiles: [ 0x5e ] },
    { name: 'parachute', tiles: [ 0x5f ] },
    { name: 'coin slot', tiles: [ 0x66 ].concat(range(0x67, 0x6e)) },
    { name: 'switch pit', tiles: [ 0x77 ] },
    { name: 'scarab beetles', tiles: [ 0x78, 0x79, 0x7a, 0x7b ] },
    { name: 'memorize cubes', tiles: range(0x7c, 0x84) },
    { name: 'Hanoi towers', tiles: range(0x85, 0x8b) },
    { name: 'walkers', tiles: [ 0x8c, 0x8d, 0x8e, 0x8f ] },
    { name: 'exchange', tiles: [ 0x90 ] },
    { name: 'magnets', tiles: [ 0x91, 0x92 ] }
]

function range(from, to) {
    var out = []
    for (var i = from; i <= to; i++) out.push(i)
    return out
}

function mechanicOf(tile) {
    for (var i = 0; i < MECHANICS.length; i++) {
        if (MECHANICS[i].tiles.indexOf(tile) !== -1) return MECHANICS[i].name
    }

    return 'tile 0x' + tile.toString(16)
}

/***** The conversion *****/

// One level, from the database's cells to the shape levels.js uses.
function convertLevel(level, notes) {
    var grid = []
    var wiring = []
    var letters = []
    var start = null
    var needs = {}

    function note(what) {
        needs[what] = true
    }

    level.cells.forEach(function(cellRow, row) {
        var gridRow = []

        cellRow.forEach(function(cell, col) {
            var tile = cell.tile
            var data = cell.data

            if (tile === FLOOR && FLOOR_FLAGS[data] !== undefined) {
                // Floor carrying a flag rather than a channel.
                if (data === 0xff) {
                    if (start) throw new Error(level.name + ' has more than one starting point')
                    start = { row: row, col: col }
                } else {
                    note(FLOOR_FLAGS[data])
                }
            } else if ((tile === ICE || tile === BOX_IN_PLACE) && (data === 0x40 || data === 0x80)) {
                note(data === 0x40 ? 'un-reverser' : 'reverser')
            } else if (tile === LETTER) {
                // A letter names its note from 1.
                var text = notes[data - 1]
                if (text) letters.push({ row: row, col: col, text: text })
            } else if (tile === SWITCH_LOW && data === GAME_OF_LIFE) {
                note('Game of Life')
            } else if (CARRIES_TILE_BELOW.indexOf(tile) !== -1) {
                // The attribute is the tile underneath, which only matters once
                // the thing standing on it can be moved off.
                note(mechanicOf(tile))
            } else if (CONNECTABLE.indexOf(tile) !== -1 && (data & CHANNEL_MASK) !== 0) {
                wiring.push({ row: row, col: col, channel: data & CHANNEL_MASK })
            }

            if (IMPLEMENTED.indexOf(tile) === -1) note(mechanicOf(tile))

            gridRow.push(tile)
        })

        grid.push(gridRow)
    })

    if (!start) throw new Error(level.name + ' has no starting point')

    var converted = {
        name: level.name,
        start: start,
        tiles: grid
    }

    if (wiring.length) converted.wiring = wiring
    if (letters.length) converted.notes = letters

    return { level: converted, needs: Object.keys(needs).sort() }
}

function convertDatabase(file) {
    var db = pdb.read(fs.readFileSync(file))

    return {
        name: db.name,
        author: db.author,
        source: path.basename(file),
        levels: db.levels.map(function(level) {
            return convertLevel(level, db.notes)
        })
    }
}

/***** Writing it out *****/

// Levels are written by hand in levels.js, so the generated file is written to
// read the same way: a grid of short names rather than a wall of numbers.
var SHORT = {
    0x04: 'F', 0x06: 'W', 0x05: 'G',
    0x62: 'C', 0x64: 'V',
    0x2a: 'X', 0x03: 'P', 0x2b: 'I', 0x70: 'M', 0x6f: 'O',
    0x2f: 'D', 0x2e: 'U', 0x2c: 'L', 0x2d: 'R',
    0x09: 'S', 0x0a: 's',
    0x0f: 'H', 0x12: 'h', 0x0b: 'N', 0x0e: 'n',
    0x58: 'B', 0x59: 'b',
    0x07: 'A'
}

function cell(tile) {
    return SHORT[tile] || String(tile)
}

function levelSource(entry, indent) {
    var level = entry.level
    var pad = indent
    var lines = []

    lines.push(pad + '{')
    lines.push(pad + '    name: ' + JSON.stringify(level.name) + ',')

    if (entry.needs.length) {
        lines.push(pad + '    needs: ' + JSON.stringify(entry.needs) + ',')
    }

    lines.push(pad + '    start: { row: ' + level.start.row + ', col: ' + level.start.col + ' },')
    lines.push(pad + '    tiles: [')

    level.tiles.forEach(function(row, index) {
        var body = row.map(function(tile) {
            return pad2(cell(tile), 4)
        }).join(',')

        lines.push(pad + '        [' + body + ' ]' + (index === level.tiles.length - 1 ? '' : ','))
    })

    lines.push(pad + '    ]' + (level.wiring || level.notes ? ',' : ''))

    if (level.wiring) {
        lines.push(pad + '    wiring: [')
        lines.push(level.wiring.map(function(wire) {
            return pad + '        { row: ' + wire.row + ', col: ' + wire.col + ', channel: ' + wire.channel + ' }'
        }).join(',\n'))
        lines.push(pad + '    ]' + (level.notes ? ',' : ''))
    }

    if (level.notes) {
        lines.push(pad + '    notes: [')
        lines.push(level.notes.map(function(letter) {
            return pad + '        { row: ' + letter.row + ', col: ' + letter.col +
                ', text: ' + JSON.stringify(letter.text) + ' }'
        }).join(',\n'))
        lines.push(pad + '    ]')
    }

    lines.push(pad + '}')

    return lines.join('\n')
}

function pad2(text, width) {
    while (text.length < width) text = ' ' + text
    return text
}

function fileSource(sets, files) {
    var header = [
        '// The original Mulg levels, converted from the game\'s own level databases.',
        '//',
        '// GENERATED by tools/convert-levels.js from ' + files.join(', ') + ' -',
        '// do not edit by hand. Run `npm run levels` after changing the converter.',
        '//',
        '// The levels, and the notes the letters carry, are Till Harbaum\'s and his',
        '// co-authors\', from the GPLv2 Mulg source; levels/original/README.md says',
        '// where they came from. A level\'s `needs` lists the mechanics the port has',
        '// not implemented yet, so a level with one is on the board but not winnable',
        '// the way it was meant to be.',
        '//',
        '// Tile numbers are the original\'s own, the same table as docs/original-tiles.md.',
        '',
        'var tiles = require(\'./tiles\')',
        '',
        '// The same short names levels.js uses, so the two read alike.',
        'var F = tiles.TILE.FLOOR',
        'var W = tiles.TILE.BLOCK',
        'var G = tiles.TILE.TARGET_CROSS',
        'var C = tiles.TILE.COIN_1',
        'var V = tiles.TILE.COIN_5',
        'var X = tiles.TILE.DEATH_CUBE',
        'var P = tiles.TILE.EMPTY_PIT',
        'var I = tiles.TILE.ICY_FLOOR',
        'var M = tiles.TILE.MUD',
        'var O = tiles.TILE.OIL',
        'var D = tiles.TILE.ONE_WAY_DOWN',
        'var U = tiles.TILE.ONE_WAY_UP',
        'var L = tiles.TILE.ONE_WAY_LEFT',
        'var R = tiles.TILE.ONE_WAY_RIGHT',
        'var S = tiles.TILE.SWITCH_LOW',
        'var s = tiles.TILE.SWITCH_HIGH',
        'var H = tiles.TILE.HGATE_CLOSED',
        'var h = tiles.TILE.HGATE_OPEN',
        'var N = tiles.TILE.VGATE_CLOSED',
        'var n = tiles.TILE.VGATE_OPEN',
        'var B = tiles.TILE.FLOOR_SWITCH_UP',
        'var b = tiles.TILE.FLOOR_SWITCH_DOWN',
        'var A = tiles.TILE.LETTER',
        ''
    ]

    var body = sets.map(function(set) {
        return [
            '    {',
            '        name: ' + JSON.stringify(set.name) + ',',
            '        author: ' + JSON.stringify(set.author) + ',',
            '        source: ' + JSON.stringify(set.source) + ',',
            '        levels: [',
            set.levels.map(function(entry) {
                return levelSource(entry, '            ')
            }).join(',\n'),
            '        ]',
            '    }'
        ].join('\n')
    }).join(',\n')

    return header.join('\n') + '\nmodule.exports = [\n' + body + '\n]\n'
}

/***** Report *****/

function report(sets) {
    var lines = []
    var playable = 0
    var total = 0

    sets.forEach(function(set) {
        lines.push('')
        lines.push(set.name + ' - ' + set.author + ' (' + set.source + ')')

        set.levels.forEach(function(entry, index) {
            var level = entry.level
            var size = level.tiles[0].length + 'x' + level.tiles.length
            var screens = Math.ceil((level.tiles[0].length - 1) / 9) *
                Math.ceil((level.tiles.length - 1) / 8)

            total++
            if (!entry.needs.length) playable++

            lines.push('  ' + pad2(String(index + 1), 2) + '. ' + padRight(level.name, 22) +
                padRight(size, 8) + padRight(screens + ' screen' + (screens === 1 ? '' : 's'), 11) +
                (entry.needs.length ? 'needs ' + entry.needs.join(', ') : 'playable'))
        })
    })

    lines.push('')
    lines.push(playable + ' of ' + total + ' levels use only what the port implements.')

    return lines.join('\n')
}

function padRight(text, width) {
    while (text.length < width) text += ' '
    return text
}

/***** Main *****/

function main() {
    var files = fs.readdirSync(LEVEL_DIR).filter(function(name) {
        return /\.pdb$/i.test(name)
    }).sort()

    if (!files.length) {
        console.error('no .pdb files in ' + LEVEL_DIR)
        process.exit(1)
    }

    var sets = files.map(function(name) {
        return convertDatabase(path.join(LEVEL_DIR, name))
    })

    fs.writeFileSync(OUT, fileSource(sets, files))

    console.log('wrote ' + path.relative(ROOT, OUT) + ' from ' + files.join(', '))
    console.log(report(sets))
}

module.exports = {
    convertLevel: convertLevel,
    convertDatabase: convertDatabase,
    IMPLEMENTED: IMPLEMENTED,
    mechanicOf: mechanicOf
}

if (require.main === module) main()
