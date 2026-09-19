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
    }
]
