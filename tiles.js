// Semantics for the original Mulg tile set.
//
// tiles/ holds all 147 tiles from the original Palm game, but the artwork is the
// only spec we have for most of them, so this registry classifies the ones whose
// meaning is unambiguous and leaves the rest as plain floor. See FEATURES.md for
// which behaviours are confirmed and which are inferred from the art.

var FLOOR = 'floor'
var WALL = 'wall'
var GOAL = 'goal'
var COIN = 'coin'
var DEADLY = 'deadly'

// Tile numbers worth naming, so level data and game code can read as prose.
var TILE = {
    FLOOR: 4,          // plain stone floor
    WALL: 6,           // green block
    VOID: 3,           // solid black
    GOAL: 37,          // the exit
    SKULL: 42,         // deadly
    WATER: 113,        // deadly, the marble sinks
    COIN_1: 98,        // gold coin worth 1
    COIN_5: 100        // gold coin worth 5
}

var KINDS = {}

function classify(kind, tileNumbers, extra) {
    tileNumbers.forEach(function(tileNumber) {
        var info = { kind: kind }
        for (var key in extra) info[key] = extra[key]
        KINDS[tileNumber] = info
    })
}

// Blocks the marble. The striped barriers, the wooden blocks and the black void
// all read as solid in the original art.
classify(WALL, [ TILE.VOID, TILE.WALL, 11, 12, 13, 14, 15, 16, 17, 18, 38, 39, 112 ])

classify(GOAL, [ TILE.GOAL ])
classify(DEADLY, [ 2, TILE.SKULL, 97, TILE.WATER, 114 ])
classify(COIN, [ TILE.COIN_1, 99 ], { value: 1 })
classify(COIN, [ TILE.COIN_5, 101 ], { value: 5 })

var FLOOR_INFO = { kind: FLOOR }

// Anything not classified above is scenery the marble rolls straight over.
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

module.exports = {
    FLOOR: FLOOR,
    WALL: WALL,
    GOAL: GOAL,
    COIN: COIN,
    DEADLY: DEADLY,
    TILE: TILE,
    tileInfo: tileInfo,
    isWall: isWall,
    isGoal: isGoal,
    isDeadly: isDeadly,
    isCoin: isCoin,
    coinValue: coinValue
}
