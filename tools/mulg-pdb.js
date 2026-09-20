// Reading a Mulg level database.
//
// The original game keeps its levels in a PalmOS .pdb file: a 78-byte database
// header, a record list, and then one record ("chunk") after another. Mulg uses
// the first chunk for the game flags, the second for the author and the notes,
// a third for custom tile art in its newer database types, and one chunk per
// level after that.
//
// The layout below is transcribed from MulgEd's Game.java (Ilan Tayary, GPLv2,
// https://sourceforge.net/projects/mulged/), which loads and saves the same
// files, and checked against the level sources in Till Harbaum's own mulg tree.
// Nothing here is guessed from the bytes.

// The PalmOS header, which is the same for every .pdb, then Mulg's own fields.
var HEADER = {
    name: 0,        // 32 bytes, NUL padded
    type: 60,       // 'Levl', 'LevF', 'LevN' or 'LevP'
    creator: 64,    // 'Mulg'
    recordCount: 76 // and then recordCount * 8 bytes of record entries
}

var HEADER_LENGTH = 78
var RECORD_ENTRY_LENGTH = 8   // a 4-byte offset, then attributes and a unique id

var LEVEL_NAME_LENGTH = 32

// The notes chunk is a run of 2-byte offsets that stops at this value. It is
// not a count: it is the first two characters of the string that follows, which
// happen to be "20", and MulgEd stops on them the same way.
var NOTES_TERMINATOR = 0x3230

// Mulg's database type is one of these; anything else is not a level set.
var TYPES = [ 'Levl', 'LevF', 'LevN', 'LevP' ]
var CREATOR = 'Mulg'

// The newer types carry one more record before the levels: the set's custom tile
// art. mulg.c decides it the same way, comparing the type as a four-byte value:
//
//   if((type >= 'LevP')&&(type != 'Levl'))   /* an additional record */
//
// Comparing the four characters in order gives the same answer, so 'LevP' has
// one and 'Levl', 'LevF' and 'LevN' do not.
function hasCustomTileRecord(type) {
    return type >= 'LevP' && type !== 'Levl'
}

function readUInt16(buffer, at) {
    return (buffer[at] << 8) | buffer[at + 1]
}

function readUInt32(buffer, at) {
    // Shifting a 32-bit value in JavaScript can go negative, so build it up.
    return readUInt16(buffer, at) * 0x10000 + readUInt16(buffer, at + 2)
}

function readFourCC(buffer, at) {
    return String.fromCharCode(buffer[at], buffer[at + 1], buffer[at + 2], buffer[at + 3])
}

// A fixed-width, NUL-padded string.
function readString(buffer, at, length) {
    var text = ''

    for (var i = 0; i < length && buffer[at + i] !== 0; i++) {
        text += String.fromCharCode(buffer[at + i])
    }

    return text
}

// A NUL-terminated string, which is how the notes are stored.
function readCString(buffer, at) {
    var text = ''

    for (var i = at; i < buffer.length && buffer[i] !== 0; i++) {
        text += String.fromCharCode(buffer[i])
    }

    return text
}

// Where each record starts and ends. The last one runs to the end of the file.
function recordRanges(buffer) {
    var count = readUInt16(buffer, HEADER.recordCount)
    var offsets = []
    var i

    for (i = 0; i < count; i++) {
        offsets.push(readUInt32(buffer, HEADER_LENGTH + i * RECORD_ENTRY_LENGTH))
    }

    var ranges = []

    for (i = 0; i < count; i++) {
        ranges.push({ start: offsets[i], end: i + 1 < count ? offsets[i + 1] : buffer.length })
    }

    return ranges
}

// The author and the notes. The chunk opens with a 2-byte offset per string,
// the first of which is the author's name behind the two characters that also
// serve as the table's terminator.
function readNotes(buffer, range) {
    var offsets = []
    var at = range.start

    while (at + 1 < range.end) {
        var offset = readUInt16(buffer, at)
        at += 2
        if (offset === NOTES_TERMINATOR) break
        offsets.push(offset)
    }

    var strings = offsets.map(function(offset) {
        return readCString(buffer, range.start + offset)
    })

    return {
        author: strings.length ? strings[0].slice(2) : '',
        // A letter on the board names its note from 1, so keep the same order.
        notes: strings.slice(1)
    }
}

// A level: a 32-byte name, a width and a height, and then width * height cells
// in rows. A cell is two bytes, the attribute first and the tile second.
function readLevel(buffer, range) {
    var at = range.start
    var name = readString(buffer, at, LEVEL_NAME_LENGTH)

    at += LEVEL_NAME_LENGTH

    var width = buffer[at]
    var height = buffer[at + 1]

    at += 2

    var cells = []

    for (var row = 0; row < height; row++) {
        var cellRow = []

        for (var col = 0; col < width; col++) {
            cellRow.push({ data: buffer[at], tile: buffer[at + 1] })
            at += 2
        }

        cells.push(cellRow)
    }

    if (at > range.end) {
        throw new Error('level "' + name + '" claims ' + width + 'x' + height +
            ' cells, which runs past the end of its record')
    }

    return { name: name, width: width, height: height, cells: cells }
}

// Everything in one database. `buffer` is anything indexable by byte - a Node
// Buffer or a Uint8Array both work.
function read(buffer) {
    var type = readFourCC(buffer, HEADER.type)
    var creator = readFourCC(buffer, HEADER.creator)

    if (creator !== CREATOR || TYPES.indexOf(type) === -1) {
        throw new Error('not a Mulg level database: type "' + type + '", creator "' + creator + '"')
    }

    var ranges = recordRanges(buffer)

    // The high scores, then the author and notes, then the custom tiles if this
    // type has them, and the levels after that.
    var customTiles = hasCustomTileRecord(type)
    var firstLevel = customTiles ? 3 : 2

    if (ranges.length < firstLevel) {
        throw new Error('a Mulg database has ' + firstLevel + ' records before its levels')
    }

    // The flags chunk is a short we do not use and then the debug flag.
    var debug = readUInt16(buffer, ranges[0].start + 2) === 0xffff
    var notes = readNotes(buffer, ranges[1])
    var name = readString(buffer, HEADER.name, LEVEL_NAME_LENGTH)

    // A debug set carries the marker in its name as well.
    if (debug && / \(D\)$/.test(name)) name = name.replace(/ \(D\)$/, '')

    return {
        name: name,
        author: notes.author,
        type: type,
        debug: debug,
        customTiles: customTiles,
        notes: notes.notes,
        levels: ranges.slice(firstLevel).map(function(range) {
            return readLevel(buffer, range)
        })
    }
}

module.exports = {
    read: read,
    hasCustomTileRecord: hasCustomTileRecord,
    TYPES: TYPES,
    CREATOR: CREATOR
}
