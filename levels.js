// Level data, kept as data rather than as a literal inside the game loop.
//
// A level is:
//   name  - shown in the HUD
//   start - { row, col } the marble's starting square
//   tiles - a grid of tile numbers from tiles/ (docs/original-tiles.md says what
//           each number is in the original game)
//   wiring - optional, [ { row, col, channel } ]. The original wires activators
//           (switches) to activated tiles (gates, pits) through 32 channels,
//           carried in a data byte beside each tile; this is the same idea,
//           listed only for the squares that have one.
//
// Every row of a level must be the same length. Levels may differ in size from
// each other; the board is rendered from the grid. The original allowed levels
// up to 37x33, larger than one screen; these all fit on one for now.
//
// They are in the order they are meant to be played. Each one leans on what the
// last one taught and adds at most one new idea, and none of them uses anything
// the port has not implemented yet - an unhandled tile would be scenery, and a
// puzzle built on scenery is not a puzzle.

var tiles = require('./tiles')

var F = tiles.TILE.FLOOR
var W = tiles.TILE.BLOCK
var G = tiles.TILE.TARGET_CROSS
var C = tiles.TILE.COIN_1
var V = tiles.TILE.COIN_5
var X = tiles.TILE.DEATH_CUBE
var P = tiles.TILE.EMPTY_PIT
var I = tiles.TILE.ICY_FLOOR
var M = tiles.TILE.MUD
var D = tiles.TILE.ONE_WAY_DOWN
var S = tiles.TILE.SWITCH_LOW
var H = tiles.TILE.HGATE_CLOSED
var N = tiles.TILE.VGATE_CLOSED
var B = tiles.TILE.FLOOR_SWITCH_UP
var O = tiles.TILE.OIL
var U = tiles.TILE.ONE_WAY_UP
var L = tiles.TILE.ONE_WAY_LEFT
var R = tiles.TILE.ONE_WAY_RIGHT
// A floor square wired to a channel is a trapdoor: it drops away into a pit
// when the channel comes on, the same way a wired pit fills in.
var T = tiles.TILE.FLOOR

module.exports = [
    {
        name: 'First Roll',
        start: { row: 7, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, F, F, C, W ],
            [ W, F, W, W, W, W, W, F, W, W ],
            [ W, F, W, F, F, F, W, F, C, W ],
            [ W, F, F, F, W, F, W, W, F, W ],
            [ W, W, W, W, W, F, F, W, F, W ],
            [ W, C, F, F, W, W, F, W, F, W ],
            [ W, F, W, F, F, F, F, W, G, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ]
    },
    {
        name: 'Detour',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, W, C, F, F, F, W ],
            [ W, F, W, F, W, F, W, W, F, W ],
            [ W, F, W, F, F, F, W, V, F, W ],
            [ W, F, W, W, W, W, W, W, F, W ],
            [ W, F, F, C, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, F, W ],
            [ W, G, F, F, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ]
    },
    {
        name: 'Mind the Death Cubes',
        start: { row: 1, col: 8 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, G, F, F, X, F, F, F, F, W ],
            [ W, W, W, F, W, W, W, W, F, W ],
            [ W, V, F, F, F, F, C, W, F, W ],
            [ W, W, W, W, X, W, F, W, F, W ],
            [ W, C, F, F, F, F, F, F, F, W ],
            [ W, F, W, W, F, W, W, W, X, W ],
            [ W, F, F, W, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ]
    },
    {
        name: 'Slippery',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, I, I, I, I, I, I, C, W ],
            [ W, W, W, W, W, W, W, W, D, W ],
            [ W, C, M, M, F, F, F, F, F, W ],
            [ W, F, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, P, F, F, F, F, W ],
            [ W, S, W, W, W, W, W, W, F, W ],
            [ W, G, F, F, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 6, col: 1, channel: 0 },   // the switch under the corridor
            { row: 5, col: 4, channel: 0 }    // the pit it fills in
        ]
    },
    {
        name: 'Locked In',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, F, F, S, W ],
            [ W, F, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, C, F, F, W ],
            [ W, W, W, W, W, W, W, W, H, W ],
            [ W, C, F, F, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, F, W ],
            [ W, F, F, F, F, F, F, F, G, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 1, col: 8, channel: 0 },   // the switch
            { row: 4, col: 8, channel: 0 }    // the gate it opens
        ]
    },
    {
        name: 'Oil Slick',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, F, F, C, W ],
            [ W, F, W, W, W, W, W, W, F, W ],
            [ W, F, F, O, O, O, O, F, F, W ],
            [ W, M, W, O, C, O, O, W, W, W ],
            [ W, F, W, O, O, O, O, F, F, W ],
            [ W, F, W, W, W, W, W, W, M, W ],
            [ W, C, F, F, F, F, W, G, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ]
    },
    {
        name: 'Step on It',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, B, N, C, W ],
            [ W, F, W, W, W, W, W, W, F, W ],
            [ W, C, F, F, B, W, F, F, F, W ],
            [ W, W, W, W, H, W, F, W, W, W ],
            [ W, F, F, F, F, F, F, W, V, W ],
            [ W, W, F, W, W, W, W, W, F, W ],
            [ W, G, F, F, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 1, col: 6, channel: 0 },   // the plate in the top corridor
            { row: 1, col: 7, channel: 0 },   // and the gate it holds open
            { row: 3, col: 4, channel: 1 },   // the plate at the dead end
            { row: 4, col: 4, channel: 1 }    // and the shortcut it opens
        ]
    },
    {
        name: 'One Way Out',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, R, R, R, R, R, R, C, W ],
            [ W, U, W, W, W, W, W, W, D, W ],
            [ W, U, W, W, G, W, W, W, D, W ],
            [ W, U, W, W, F, W, W, W, D, W ],
            [ W, U, W, W, C, W, W, W, D, W ],
            [ W, U, W, W, F, W, W, W, D, W ],
            [ W, V, L, L, L, L, L, C, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ]
    },
    {
        name: 'Double Act',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, C, F, F, W ],
            [ W, W, W, W, W, S, W, W, F, W ],
            [ W, C, F, F, N, F, F, F, F, W ],
            [ W, F, V, W, W, W, W, W, W, W ],
            [ W, F, F, F, I, I, I, F, X, W ],
            [ W, W, W, W, W, S, W, F, W, W ],
            [ W, G, F, F, N, F, F, F, W, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 2, col: 5, channel: 0 },   // the switch in the roof of the top corridor
            { row: 3, col: 4, channel: 0 },   // and the gate across the second one
            { row: 6, col: 5, channel: 1 },   // the switch under the ice
            { row: 7, col: 4, channel: 1 }    // and the last gate, in front of the exit
        ]
    },
    {
        name: 'Cold Feet',
        start: { row: 7, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, G, F, F, F, F, F, F, C, W ],
            [ W, W, W, W, W, W, W, W, I, W ],
            [ W, W, W, V, W, W, W, W, I, W ],
            [ W, W, W, F, W, W, W, W, I, W ],
            [ W, S, W, F, W, W, W, W, I, W ],
            [ W, F, W, P, W, C, W, W, I, W ],
            [ W, F, F, F, I, I, I, I, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 5, col: 1, channel: 0 },   // the switch in the corner
            { row: 6, col: 3, channel: 0 }    // and the pit it fills in
        ]
    },
    {
        name: 'Trapdoor',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, T, F, F, V, W, W ],
            [ W, F, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, F, F, F, W ],
            [ W, W, W, W, S, W, W, W, F, W ],
            [ W, C, F, F, F, F, F, F, F, W ],
            [ W, P, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, C, F, F, F, G, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 4, col: 4, channel: 0 },   // one switch
            { row: 6, col: 1, channel: 0 },   // fills the pit in front of the exit
            { row: 1, col: 4, channel: 0 }    // and drops the floor behind you
        ]
    },
    {
        name: 'Slick Work',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, O, O, M, F, F, C, F, W ],
            [ W, W, W, W, W, W, W, W, F, W ],
            [ W, C, M, I, I, I, M, F, F, W ],
            [ W, F, W, W, W, W, W, W, F, W ],
            [ W, I, I, C, X, F, F, F, V, W ],
            [ W, F, W, W, W, W, W, W, M, W ],
            [ W, G, F, F, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ]
    },
    {
        name: 'Pressure Run',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, I, I, I, I, I, M, C, W ],
            [ W, W, W, W, W, W, W, W, F, W ],
            [ W, W, W, V, F, S, W, W, F, W ],
            [ W, W, W, W, B, W, W, W, F, W ],
            [ W, W, W, W, H, W, W, W, F, W ],
            [ W, W, W, W, B, W, W, W, M, W ],
            [ W, G, N, F, F, C, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 6, col: 4, channel: 0 },   // the plate at the foot of the shaft
            { row: 5, col: 4, channel: 0 },   // the gate it holds open
            { row: 4, col: 4, channel: 0 },   // and the plate that lets you back out
            { row: 3, col: 5, channel: 1 },   // the switch at the top of the shaft
            { row: 7, col: 2, channel: 1 }    // opens the last gate, by the exit
        ]
    },
    {
        name: 'The Vault',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, F, F, F, F, F, M, F, W ],
            [ W, W, W, S, W, W, W, W, H, W ],
            [ W, C, F, F, F, F, F, F, F, W ],
            [ W, H, W, W, W, S, W, W, W, W ],
            [ W, V, F, F, F, F, F, M, F, W ],
            [ W, W, W, W, S, W, W, W, H, W ],
            [ W, G, F, F, F, F, F, C, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 2, col: 3, channel: 0 },
            { row: 2, col: 8, channel: 0 },
            { row: 4, col: 5, channel: 1 },
            { row: 4, col: 1, channel: 1 },
            { row: 6, col: 4, channel: 2 },
            { row: 6, col: 8, channel: 2 }
        ]
    },
    {
        name: 'The Long Way Round',
        start: { row: 1, col: 1 },
        tiles: [
            [ W, W, W, W, W, W, W, W, W, W ],
            [ W, F, M, O, O, O, M, F, C, W ],
            [ W, W, W, W, W, W, W, W, D, W ],
            [ W, F, F, C, X, F, F, F, F, W ],
            [ W, F, F, X, C, F, X, F, F, W ],
            [ W, V, I, I, I, I, I, I, F, W ],
            [ W, P, W, W, S, W, W, W, F, W ],
            [ W, G, W, F, F, F, F, F, F, W ],
            [ W, W, W, W, W, W, W, W, W, W ]
        ],
        wiring: [
            { row: 6, col: 4, channel: 0 },   // the switch under the rink
            { row: 6, col: 1, channel: 0 }    // and the pit in front of the exit
        ]
    }
]
