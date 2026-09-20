# Mulg: original vs. this HTML5 port

A feature-by-feature comparison between Till Harbaum's Palm OS
[Mulg](http://www.harbaum.org/till/palm/mulg/) and the current state of this
port.

**Where the "original" column comes from.** The authority for the game's elements
is **MulgEd**, the Mulg game and level editor by Ilan Tayary
(<https://sourceforge.net/projects/mulged/>), whose source carries a tile-help
table naming and describing all 147 tiles, with a flags column saying which are
blocking, collectable, activators or activated. `docs/original-tiles.md` has that
table. MulgEd is GPLv2, the same licence as this repository.

An earlier version of this file inferred tile meanings from the artwork in
`tiles/` and got several of them wrong: tile 5 is the exit, not tile 37; tile 3 is
a pit, not a wall; tiles 113/114 are a pushable crate, not water; 133–139 are
Towers of Hanoi pieces, not crumbling blocks; and Mulg has no teleporters at all.
Those are now corrected against the table. Rows still resting on something softer
say so.

Rows marked **done** have been implemented in this port.

---

## 1. Implemented today

| Feature | State | Where |
| --- | --- | --- |
| Tile grid rendered from level data | Board built from the grid, any size | `render.js` |
| Full original tile art available | All 147 tiles present as GIFs | `tiles/` |
| A marble with momentum | Velocity with per-surface decay and a stop threshold | `game.js` |
| Arrow-key tilt control | Multi-key aware, sampled every 50 ms to mimic the Palm's input rate | `index.js`, `game.js` |
| 60 fps loop scaled off the original's 20 fps | `frame-loop` at `20 × FPS_MULTIPLIER` | `index.js` |
| Wall collision, sides and corners | Movement is stepped a sixteenth of a square at a time and checked after each step, off the sides and off the corners, and a hit costs the ball 30% of its speed | `game.js`, `collision-checking.js` |
| Fifteen levels, held as data | `name`, `start`, `tiles` per level | `levels.js` |
| The exit (Target cross, tile 5) | Rolling onto it finishes the level | `game.js`, `tiles.js` |
| Death and three lives | Empty pit (3), death cube (42), spent descending floor (87). A death cube kills on touch and is solid besides, so the ball never reaches its square; a pit only takes the ball that is over it | `game.js` |
| Coins and a score | 1 and 5 cent coins (98, 100) | `game.js` |
| Icy floor, oil, mud | Per-tile friction and steering | `tiles.js` |
| One-way tiles | 44–47; the ball cannot come back through | `game.js` |
| A clock, and level progression | Per-level timer, R moves you on | `game.js`, `index.js` |
| Switches and channels | 32 channels wiring switches to gates and pits | `game.js`, `levels.js` |
| Gates that open and close | 11/14 and 15/18, on a channel, sliding through their in-between frames | `tiles.js` |
| A gate closing on the ball | Costs a life, like any other way of dying | `game.js` |
| Pits that fill in, floors that drop away | 3/4, on a channel | `tiles.js` |
| Floor switches | 88/89, held down only while the ball is on them | `game.js` |
| Level selector | Jumps to any of the levels, keeping the score banked so far | `index.js`, `game.js` |
| 1x/2x speed button | Runs the whole simulation twice per frame, so the game plays the same, faster | `index.js` |

## 2. Missing

Ordered roughly by how much each one blocks the rest.

### 2.1 The game around the level

| # | Feature in the original | Status here |
| --- | --- | --- |
| 1 | **High-score table** | Not started |
| 2 | **Level selector** | Not started |
| 3 | **Game-pack / level-set selector** | Not started |
| 4 | **Menus** — new game, options, about | Not started |
| 5 | **Sound effects** | Not started |
| 6 | **Timer faithful to the original** | A per-level clock counts **up**. A level in the original carries no time limit in its data, so a countdown is not something the level format asks for; at what rate the original's clock ran on a Palm III is still unknown |

### 2.2 Level data

| # | Feature in the original | Status here |
| --- | --- | --- |
| 7 | **Hundreds of levels**, shipped as level sets | Fifteen hand-made levels, one screen each, built out of the mechanics the port already has |
| 8 | **Levels larger than one screen.** MulgEd allows up to 37×33 tiles, so a level scrolls or pages | Single screen only |
| 9 | **`.pdb` level set reading** (Palm database files) | Not started |
| 10 | **`.lev` level set reading** | Not started |
| 11 | **A level editor** | Not started; MulgEd already exists and is the reference |
| 12 | **Channels.** Activator tiles are wired to activated tiles, which is how levels build their puzzles; the level format carries those connections | **done** — `levels.js` carries a `wiring` list of `{ row, col, channel }`, 32 channels as in the original. The original packs the channel into a data byte beside each tile; a `.lev` reader would unpack it into this shape |

### 2.3 Tile behaviours

`docs/original-tiles.md` is the full table. What is left:

| # | Element | Tiles | Status |
| --- | --- | --- | --- |
| 13 | **Corner collision.** Bouncing off a wall *corner*, not just its flat side | — | **done** — the original's own 16x16 table of which diagonal neighbours the ball's round shape reaches into |
| 14 | **Switches**, low and high, that activate a channel when touched | 009, 010 | **done** — bumping one throws its channel and the tile shows which way it is set |
| 15 | **Gates** that open and close on a channel | 011–018 | **done**, including the frames between (012, 013, 016, 017), which a gate rests on for 160 ms each the way the original's does, and which kill the ball caught in them |
| 16 | **Swings** — through one way, then back | 019–022 | Missing |
| 17 | **Ventilator** — sucks the ball in and you lose, when switched on | 023–026 | Missing; it is channel-driven, so it is ready to be added now |
| 18 | **Hole** — pulls the ball towards its centre | 027 | Missing |
| 19 | **Bump** — pushes the ball away from its centre | 028 | Missing |
| 20 | **Dice** — rolled when the ball touches them, landing on a random face | 029–034 | Missing |
| 21 | **Key and lock.** A key in the inventory turns a lock into a switch | 035, 037 | Missing, and there is no inventory |
| 22 | **Heavy box** — pushed onto floor, or into a pit to fill it | 038, 039 | Inert wall |
| 23 | **Light box** — same, but breaks if hit too hard | 113, 114 | Inert wall |
| 24 | **Switch pit** — activates its channel when a box is pushed in | 119 | Missing |
| 25 | **Bouncer** — pinball behaviour | 040 | Missing |
| 26 | **Bombs, matches and the bomb dispenser.** A lit bomb explodes, leaving a hole and turning nearby ice into pits | 048, 051, 092 | Missing |
| 27 | **Grooves** — pull the ball towards their centre | 053–068 | Missing; currently plain floor |
| 28 | **Ramparts** — push the ball away from their centre | 069–084 | Missing; currently plain floor |
| 29 | **Descending floors** — collapse after two more crossings | 085, 086, 087 | Only the spent one (087) is deadly; 085/086 do not wear out yet |
| 30 | **Floor switches** — hidden switches pressed by the ball | 088, 089 | **done** — held on only while the ball is on the square. Whether the original latches instead is not stated; this is the reading of "when the ball presses it, it activates" |
| 31 | **Flip tiles** — toggle an X and a Y channel | 090, 091 | Missing; they need two channels per cell, which the `wiring` list does not carry yet |
| 32 | **Parachute** — lets the ball hover over pits, without steering | 095 | Missing |
| 33 | **Coin slot** — activated by spending a coin | 102 | Missing; coins are score, not currency |
| 34 | **Letters and notes** — collected, then read | 007 | Missing |
| 35 | **Scarab beetles** — chase the ball, push it around, and may steal a key | 120–123 | Missing |
| 36 | **Towers of Hanoi pieces** — pushed onto larger pieces and detached again | 133–139 | Inert walls |
| 37 | **Walkers** — blocks that walk in one direction | 140–143 | Inert walls |
| 38 | **Magnets**, positive and negative, pulling or pushing harder the closer the ball | 145, 146 | Inert walls |

### 2.4 Input and presentation

| # | Feature in the original | Status here |
| --- | --- | --- |
| 39 | **Stylus-drag tilt control** — the original's real control scheme | Arrow keys only |
| 40 | **Touch/swipe control**, weighted like the stylus drag | Not started |
| 41 | **Phone-sized layout** | Fixed 320-wide board, no responsive layout |

### 2.5 Repo health

| # | Item | Status |
| --- | --- | --- |
| 42 | The test suite threw on its first assertion | **done** — the collision list defaults to the green block, and the suite now covers the tile registry, the level data and the game rules. `tape` was pinned forward from 4.3.0, which dropped tests at random on modern Node |
| 43 | The page relied on quirks mode to parse unitless `left`/`top` | **done** — the page has a doctype and positions carry `px` |
| 44 | `build.js` is a committed bundle that has to be rebuilt by hand after every source change | Still true; `npm run build` before committing |
| 45 | The floor button (88/89) is held down only while the ball sits on it | Still true, and not what the original does. In `mulg.c` a `BUT0` is a *toggle*: rolling onto it throws its channel and the channel stays thrown, which is why the original can have a door you open and then roll through. Held-down plates cannot do that now that a closing gate kills, so a plate can no longer usefully open anything the ball has to cross |

---

## 3. Suggested order of work

1. **Forces on the ball** — grooves, ramparts, holes, bumps, bouncers and
   magnets. They are all the same shape of change to the movement code, and they
   are what makes the original's levels play the way they do. *(items 18, 19, 25,
   27, 28, 38)*
2. **The floor button as a toggle** — item 45. It is a two-line change to
   `game.js` and it is what lets a level have a door you open and then roll
   through, which is how the original's own levels are built.
3. **The rest of the channel-driven tiles** — the ventilator, flip tiles (which
   need two channels per square), locks and keys, and the coin slot, now that
   channels exist. *(items 17, 21, 31, 33)*
4. **Things that move or change** — boxes, descending floors, walkers, beetles,
   bombs. *(items 22, 23, 24, 26, 29, 35, 37)*
5. **Content** — multi-screen levels, then the `.pdb` / `.lev` readers so the
   original level sets can be played, then a level selector. *(items 7–10)*
6. **Reach** — touch control and a responsive layout, so it plays on a phone the
   way the original played on a Palm. *(items 39–41)*
7. **Polish** — high scores, sound, menus, the rarer elements. *(items 1–5, 16,
   17, 20, 32, 34, 36)*
