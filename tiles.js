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
    FLOOR_SWITCH_UP: 88,   // hidden in the floor: armed, waiting to be rolled on
    FLOOR_SWITCH_DOWN: 89, // the same button, spent
    DESCENDING_FLOOR: 85,  // gives way a step at a time, three crossings in all
    DESCENDING_FLOOR_2: 86,
    DESCENDING_FLOOR_3: 87,
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

// Switches have two forms, and how they are thrown differs.
//
// A wall switch is solid, so the ball throws it by bumping into it, and its two
// forms show which way its channel is set.
//
// A floor button is thrown by rolling onto it, and its two forms are not the
// channel's state but the button's own: 88 is armed and 89 is spent. Throwing a
// button spends it and re-arms every other button on the same channel, so a lone
// button works once and a pair of them toggle back and forth. That is what the
// original does, and it is not the same as holding the channel on while the ball
// sits on the square.
var BUMPED = 'bumped'
var ROLLED_ONTO = 'rolled-onto'

var SWITCH_FORMS = [
    { off: TILE.SWITCH_LOW, on: TILE.SWITCH_HIGH, thrownBy: BUMPED },
    { off: TILE.FLOOR_SWITCH_UP, on: TILE.FLOOR_SWITCH_DOWN, thrownBy: ROLLED_ONTO }
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

classify(DEADLY, [ TILE.EMPTY_PIT, TILE.DEATH_CUBE ])

// A descending floor drops one step each time the ball rolls onto it anew, and
// the step past the last one is an open pit. The original does this by counting
// the tile number up until it passes 87; the chain is spelled out here instead.
var WEARS_TO = {}
WEARS_TO[TILE.DESCENDING_FLOOR] = TILE.DESCENDING_FLOOR_2
WEARS_TO[TILE.DESCENDING_FLOOR_2] = TILE.DESCENDING_FLOOR_3
WEARS_TO[TILE.DESCENDING_FLOOR_3] = TILE.EMPTY_PIT

// What a square becomes when the ball crosses it, or null if crossing leaves it
// as it was.
function wornBy(tileNumber) {
    return WEARS_TO[tileNumber] === undefined ? null : WEARS_TO[tileNumber]
}

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

// The other form of a tile that can be switched, or null if it has none.
function activatedPartner(tileNumber) {
    return PARTNERS[tileNumber] === undefined ? null : PARTNERS[tileNumber]
}

// The pair of forms for a switch, or null if this tile is not one. `thrownBy`
// says how the ball works it: by bumping into it, or by rolling onto it.
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
    surface: surface,
    wornBy: wornBy,
    activatedPartner: activatedPartner,
    switchForms: switchForms,
    frameSequence: frameSequence,
    isLetter: isLetter,
    LETTER: LETTER,
    BUMPED: BUMPED,
    ROLLED_ONTO: ROLLED_ONTO,
    CHANNELS: 32
}
