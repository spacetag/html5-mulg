// What the original Mulg tiles are and how they behave.
//
// Tile numbers, names and effects come from MulgEd's tile help, not from looking
// at the artwork. docs/original-tiles.md has the full table and the source.
// Anything this port does not implement yet is left as plain floor, so an
// unhandled tile is scenery rather than a wrong guess.

var FLOOR = 'floor'
var WALL = 'wall'
var GOAL = 'goal'
var COIN = 'coin'
var DEADLY = 'deadly'
var ONE_WAY = 'one-way'
var LETTER = 'letter'

var TILE = {
    EMPTY_PIT: 3,       // the ball falls in and the level is lost
    FLOOR: 4,
    TARGET_CROSS: 5,    // the exit
    BLOCK: 6,           // the basic wall
    LETTER: 7,          // carries a note the player collects and reads
    SWITCH_LOW: 9,      // a switch the ball bumps, off
    SWITCH_HIGH: 10,    // the same switch, on
    VGATE_CLOSED: 11,
    VGATE_OPEN: 14,
    HGATE_CLOSED: 15,
    HGATE_OPEN: 18,
    FLOOR_SWITCH_UP: 88,   // hidden in the floor, held down by the ball
    FLOOR_SWITCH_DOWN: 89,
    DEATH_CUBE: 42,     // deadly on contact
    ICY_FLOOR: 43,      // no friction
    ONE_WAY_LEFT: 44,
    ONE_WAY_RIGHT: 45,
    ONE_WAY_UP: 46,
    ONE_WAY_DOWN: 47,
    COIN_1: 98,
    COIN_5: 100,
    OIL: 111,           // slippery, and the player barely steers
    MUD: 112            // slows the ball to a stop
}

// The original wires activators to activated tiles through 32 channels. An
// activated tile has two forms and shows the other one while its channel is on.
var PARTNERS = {}

function pair(a, b) {
    PARTNERS[a] = b
    PARTNERS[b] = a
}

pair(TILE.EMPTY_PIT, TILE.FLOOR)        // a pit fills in, a floor drops away
pair(TILE.VGATE_CLOSED, TILE.VGATE_OPEN)
pair(TILE.HGATE_CLOSED, TILE.HGATE_OPEN)

// A gate does not jump between shut and open: the tile set carries the frames in
// between, which are what the barrier looks like part-way out of the wall.
var FRAME_SEQUENCES = [
    [ TILE.VGATE_CLOSED, 12, 13, TILE.VGATE_OPEN ],
    [ TILE.HGATE_CLOSED, 16, 17, TILE.HGATE_OPEN ]
]

// Switches show their own channel's state, so they have two forms as well.
var SWITCH_FORMS = [
    { off: TILE.SWITCH_LOW, on: TILE.SWITCH_HIGH, momentary: false },
    { off: TILE.FLOOR_SWITCH_UP, on: TILE.FLOOR_SWITCH_DOWN, momentary: true }
]

// How a square treats the ball rolling over it. `decayOn` applies while the
// player is pushing, `decayOff` while the ball coasts, and `control` scales how
// much a keypress is worth. Floor keeps the numbers the port has always used.
var SURFACES = {}
var FLOOR_SURFACE = { decayOn: 0.99, decayOff: 0.9, control: 1 }

SURFACES[TILE.ICY_FLOOR] = { decayOn: 1, decayOff: 1, control: 1 }
SURFACES[TILE.OIL] = { decayOn: 1, decayOff: 1, control: 0.25 }
SURFACES[TILE.MUD] = { decayOn: 0.6, decayOff: 0.45, control: 1 }

var ONE_WAY_DIRECTIONS = {}
ONE_WAY_DIRECTIONS[TILE.ONE_WAY_LEFT] = 'left'
ONE_WAY_DIRECTIONS[TILE.ONE_WAY_RIGHT] = 'right'
ONE_WAY_DIRECTIONS[TILE.ONE_WAY_UP] = 'up'
ONE_WAY_DIRECTIONS[TILE.ONE_WAY_DOWN] = 'down'

var KINDS = {}

function classify(kind, tileNumbers, extra) {
    tileNumbers.forEach(function(tileNumber) {
        var info = { kind: kind }
        for (var key in extra) info[key] = extra[key]
        KINDS[tileNumber] = info
    })
}

// Blocking. The switches, boxes, Hanoi pieces, walkers, magnets and the closed
// gates all have their own behaviour in the original; until that is written they
// are at least solid, which is how they read on the board. A gate part-way open
// is solid too, so the ball cannot squeeze through one that is still moving.
classify(WALL, [
    TILE.BLOCK,
    9, 10,          // switches, low and high
    11, 12, 13,     // vertical gate, shut and opening
    15, 16, 17,     // horizontal gate, shut and opening
    38, 113,        // heavy box, light box
    133, 134, 135, 136, 137, 138, 139, // Hanoi tower pieces
    140, 141, 142, 143,                // walkers
    144,            // exchange
    145, 146        // magnets
])

classify(GOAL, [ TILE.TARGET_CROSS ])
classify(LETTER, [ TILE.LETTER ])

// 87 is a descending floor with no crossings left, so stepping on it is a fall.
classify(DEADLY, [ TILE.EMPTY_PIT, TILE.DEATH_CUBE, 87 ])

classify(COIN, [ TILE.COIN_1 ], { value: 1 })
classify(COIN, [ TILE.COIN_5 ], { value: 5 })

Object.keys(ONE_WAY_DIRECTIONS).forEach(function(tileNumber) {
    classify(ONE_WAY, [ Number(tileNumber) ], { direction: ONE_WAY_DIRECTIONS[tileNumber] })
})

var FLOOR_INFO = { kind: FLOOR }

// Everything else is scenery the ball rolls straight over.
function tileInfo(tileNumber) {
    return KINDS[tileNumber] || FLOOR_INFO
}

function isWall(tileNumber) {
    return tileInfo(tileNumber).kind === WALL
}

function isGoal(tileNumber) {
    return tileInfo(tileNumber).kind === GOAL
}

function isDeadly(tileNumber) {
    return tileInfo(tileNumber).kind === DEADLY
}

function isCoin(tileNumber) {
    return tileInfo(tileNumber).kind === COIN
}

function coinValue(tileNumber) {
    return isCoin(tileNumber) ? tileInfo(tileNumber).value : 0
}

// The direction a one-way tile lets the ball travel, or null if it is not one.
function oneWayDirection(tileNumber) {
    var info = tileInfo(tileNumber)
    return info.kind === ONE_WAY ? info.direction : null
}

// Whether a square lets a ball roll in from a given heading. mulg.c's check_tile
// (lines 1126-1137) whitelists the single heading an arrow points in, plus its
// dir 0, and refuses the other seven: both perpendiculars and all four diagonals.
// `entering` is the heading as a pair of -1/0/1 components, or null when the ball
// is already overlapping the square rather than rolling into it.
//
// The rule lives here, on its own, because it is the one part of the collision
// model that is easy to get subtly wrong: the copy of mulg.c vendored in the
// ODROID port replaces those four lines with direction ranges that let the
// diagonals through, so a blacklist reading of it looks right and plays wrong.
function oneWayAdmits(tileNumber, entering) {
    var arrow = oneWayDirection(tileNumber)

    if (arrow === null) return true
    if (!entering) return true

    if (arrow === 'left') return entering.x === -1 && entering.y === 0
    if (arrow === 'right') return entering.x === 1 && entering.y === 0
    if (arrow === 'up') return entering.x === 0 && entering.y === -1

    return entering.x === 0 && entering.y === 1
}

function surface(tileNumber) {
    return SURFACES[tileNumber] || FLOOR_SURFACE
}

// The frames a tile animates through, in order from shut to open, or null if it
// changes in one step.
function frameSequence(tileNumber) {
    for (var i = 0; i < FRAME_SEQUENCES.length; i++) {
        if (FRAME_SEQUENCES[i].indexOf(tileNumber) !== -1) return FRAME_SEQUENCES[i]
    }

    return null
}

function isLetter(tileNumber) {
    return tileInfo(tileNumber).kind === LETTER
}

// A gate in any state but fully open: shut, or part-way through sliding. mulg.c
// treats all of those as solid, and kills the marble that turns out to be inside
// one, which is how a gate closing on the ball costs a life.
function isClosedGate(tileNumber) {
    for (var i = 0; i < FRAME_SEQUENCES.length; i++) {
        var frames = FRAME_SEQUENCES[i]
        var frame = frames.indexOf(tileNumber)

        if (frame !== -1) return frame < frames.length - 1
    }

    return false
}

// The other form of a tile that can be switched, or null if it has none.
function activatedPartner(tileNumber) {
    return PARTNERS[tileNumber] === undefined ? null : PARTNERS[tileNumber]
}

// The pair of forms for a switch, or null if this tile is not one. A momentary
// switch is held on only while the ball is on it; the other kind toggles.
function switchForms(tileNumber) {
    for (var i = 0; i < SWITCH_FORMS.length; i++) {
        if (SWITCH_FORMS[i].off === tileNumber || SWITCH_FORMS[i].on === tileNumber) {
            return SWITCH_FORMS[i]
        }
    }

    return null
}

module.exports = {
    FLOOR: FLOOR,
    WALL: WALL,
    GOAL: GOAL,
    COIN: COIN,
    DEADLY: DEADLY,
    ONE_WAY: ONE_WAY,
    TILE: TILE,
    FLOOR_SURFACE: FLOOR_SURFACE,
    tileInfo: tileInfo,
    isWall: isWall,
    isGoal: isGoal,
    isDeadly: isDeadly,
    isCoin: isCoin,
    coinValue: coinValue,
    oneWayDirection: oneWayDirection,
    oneWayAdmits: oneWayAdmits,
    surface: surface,
    activatedPartner: activatedPartner,
    switchForms: switchForms,
    frameSequence: frameSequence,
    isClosedGate: isClosedGate,
    isLetter: isLetter,
    LETTER: LETTER,
    CHANNELS: 32
}
