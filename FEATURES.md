# Mulg: original vs. this HTML5 port

A feature-by-feature comparison between Till Harbaum's Palm OS
[Mulg](http://www.harbaum.org/till/palm/mulg/) and the current state of this
port.

**Where the "original" column comes from.** Two sources, both GPLv2, the same
licence as this repository.

For what each tile *is*: **MulgEd**, the Mulg game and level editor by Ilan Tayary
(<https://sourceforge.net/projects/mulged/>), whose source carries a tile-help
table naming and describing all 147 tiles, with a flags column saying which are
blocking, collectable, activators or activated. `docs/original-tiles.md` has that
table.

For what the game *does*: **Till Harbaum's own C source**, `mulg.c`. It is
reachable despite harbaum.org being blocked, and `docs/original-c-logic.md` is
transcribed from it with line references — the movement model, the rule each
square applies, and the shape of the game around a level. Rows below that used to
say a behaviour was unknown now cite it.

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
| 60 fps loop scaled off the original's 20 fps | `frame-loop` at `20 × FPS_MULTIPLIER`. The original's frame is nearer 25 fps; see row 6 | `index.js` |
| Wall collision, edge bounce | Bounces off the flat sides of any blocking tile | `collision-checking.js` |
| Fifteen levels, held as data | `name`, `start`, `tiles` per level | `levels.js` |
| The exit (Target cross, tile 5) | Only its middle finishes the level, so the ball can clip a corner and roll on | `game.js`, `tiles.js` |
| Death and three lives | Empty pit (3), death cube (42). The lives are this port's own; see row 6a | `game.js` |
| Coins and a score | 1 and 5 cent coins (98, 100) | `game.js` |
| Icy floor, oil, mud | Per-tile friction and steering. The numbers are not the original's yet; see row 45 | `tiles.js` |
| Descending floors that give way | 85/86/87: three crossings, then an open pit | `game.js`, `tiles.js` |
| One-way tiles | 44–47; only a ball travelling the way the arrow points gets in, from any side | `game.js` |
| A clock, and level progression | Per-level timer, R moves you on | `game.js`, `index.js` |
| Switches and channels | 32 channels wiring switches to gates and pits | `game.js`, `levels.js` |
| Gates that open and close | 11/14 and 15/18, on a channel, a frame every 160 ms as in the original | `tiles.js` |
| Pits that fill in, floors that drop away | 3/4, on a channel | `tiles.js` |
| Floor buttons | 88/89, armed or spent: rolling onto one throws its channel for good and re-arms the others on that channel | `game.js` |
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
| 6 | **Timer faithful to the original** | A per-level clock counts **up**, which is right: the original counts up too and keeps a per-level **best time**, and beating it is what unlocks the next level. Its clock advances 40 ms a frame (`level_time += 40`), against the 50 Hz its event loop asks for, so the frame this port calls 20 fps is really nearer 25 |
| 6a | **No lives, and no score** | Wrong here. The original has neither: dying restarts the level, and the 1 and 5 coins are collectables spent at a coin slot, not points. This port's three lives and its score are inventions. Changing that takes visible features away, so it is Jo's call |

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
| 13 | **Corner collision.** Bouncing off a wall *corner*, not just its flat side | — | Missing. No longer guesswork: the original does it with a 16x16 overlap table, `hole.c`, indexed by the marble's position within its square, whose top bits name the diagonal neighbours it touches |
| 13a | **Sub-stepped movement** | — | Missing. The original walks a move out one pixel at a time and tests collision after each axis, which is its fix for the marble tunnelling into stone. This port moves the whole distance in one go |
| 13b | **A bounce costs 30% of the speed** (`DUSCH 70`) | — | Missing; this port reflects at full speed |
| 14 | **Switches**, low and high, that activate a channel when touched | 009, 010 | **done** — bumping one throws its channel and the tile shows which way it is set |
| 15 | **Gates** that open and close on a channel | 011–018 | **done**, including the in-between frames (012, 013, 016, 017), a frame every 160 ms as in the original. Still missing: a gate closing on the ball should end the level, and frames 1 to 3 are the deadly ones |
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
| 29 | **Descending floors** — collapse after two more crossings | 085, 086, 087 | **done** — a square drops one step each time the ball rolls onto it anew, 085 to 086 to 087 to an open pit, so it takes three crossings. A plain floor marked as vanishing by its attribute byte is the original's other way of spelling this, and needs a per-square attribute the level format here does not carry yet |
| 30 | **Floor switches** — hidden switches pressed by the ball | 088, 089 | **done** — a floor button is **armed or spent**, not held down. Rolling onto 088 throws its channel and leaves the square as 089, which does nothing; throwing it re-arms every other button on the same channel, so a lone button is a one-shot and a pair toggle back and forth |
| 31 | **Flip tiles** — toggle an X and a Y channel | 090, 091 | Missing; they need two channels per cell, which the `wiring` list does not carry yet |
| 32 | **Parachute** — lets the ball hover over pits, without steering | 095 | Missing |
| 33 | **Coin slot** — activated by spending a coin | 102 | Missing, and confirmed: coins really are currency. The original puts a picked-up coin in a five-slot inventory and the slot takes a 5 first, then a 1. See row 6a |
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

### 2.6 The movement model

Settled by the C source, and the biggest remaining block of work.
`docs/original-c-logic.md` has the numbers and the line references.

| # | Feature in the original | Status here |
| --- | --- | --- |
| 45 | **Friction as a flat 5% a frame** (`SLOW 95`), applied whether or not the player is pushing; mud halves the speed instead (`SWAMP_SLOW 50`); ice removes friction and does **not** reduce steering | This port has a `decayOn`/`decayOff` pair and a `control` scale per surface, with numbers of its own |
| 46 | **Oil is a lingering state, not a surface.** Touching oil sets a counter of 500 frames that both suppresses steering and weakens friction, fading as it drains — and it follows the ball off the square | Oil here is a tile with a quarter of the steering, and it stops mattering the moment the ball leaves it |
| 47 | **Units.** Position and speed are fixed point in 1/256 of a pixel, and a tile is 16 pixels. There is no stop threshold and no speed cap; integer truncation brings the ball to rest | This port works in floating-point pixels with a 0.1 stop threshold and a cap of 99, both inventions |
| 48 | **Push magnitude.** A unit of input is worth 32 speed units, scaled by the oil counter. The original reads the stylus's movement delta per event; the ODROID port, which is the nearest reference for a key-driven port, pushes by ±2 a frame per held direction | Input adds 1 unit per 50 ms, on a different scale |
| 49 | **Reversing squares.** A path, box or ice square whose attribute byte says so inverts the player's input | Missing, and the level format here carries no such attribute |
| 50 | **One-way arrows** admit only a ball travelling the way they point — from above and below as well as from behind — and put no restraint at all on a ball already standing on one | **done** on both counts. The looser "no going back" rule and the speed-zeroing on the square itself are both gone |

---

## 3. Suggested order of work

1. **The movement model** — the units, the friction constants, the push
   magnitude, sub-stepping, the cost of a bounce, and corner collision. How the
   game feels rests on all of it, and it is now fully specified. *(items 13, 13a,
   13b, 45–48)*
2. **Forces on the ball** — grooves, ramparts, holes, bumps, bouncers and
   magnets. They are all the same shape of change to the movement code, and they
   are what makes the original's levels play the way they do. *(items 18, 19, 25,
   27, 28, 38)*
3. **The rest of the channel-driven tiles** — the ventilator, flip tiles (which
   need two channels per square), locks and keys, and the coin slot, now that
   channels exist. *(items 17, 21, 31, 33)*
4. **Channels as independent toggles** rather than one boolean per channel, so
   squares wired together can sit in opposite states. *(item 12)*
5. **Things that move or change** — boxes, walkers, beetles, bombs. *(items 22,
   23, 24, 26, 35, 37)*
6. **Content** — multi-screen levels, then the `.pdb` / `.lev` readers so the
   original level sets can be played. *(items 7–10)*
7. **Reach** — touch control and a responsive layout, so it plays on a phone the
   way the original played on a Palm. *(items 39–41)*
8. **Polish** — best times, sound, menus, the rarer elements. *(items 1–5, 16, 20,
   32, 34, 36)*
