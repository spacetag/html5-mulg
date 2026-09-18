# Mulg: original vs. this HTML5 port

A feature-by-feature comparison between Till Harbaum's original Palm OS
[Mulg / Mulg II](http://www.harbaum.org/till/palm/mulg/) and the current state of
this port.

**How this list was built.** The "this port" column comes from reading the code in
this repository. The "original" column comes from three sources, and each row says
which one it rests on:

- **[doc]** — described in prose about the original game (its Palm pages, the
  [PalmDB entry](https://palmdb.net/app/mulg): *"Mulg is a very simple maze game.
  The object is to guide a marble through various mazes"*, with *"stones blocking
  your passage, slippery ice, flipper bumpers, and more"*, *"hundreds of levels"*,
  and a separate **Level Editor**).
- **[art]** — **inferred** from the original game's own tile set, all 147 tiles of
  which are checked into `tiles/`. The artwork is unambiguous about *what* an
  element is (a horseshoe magnet, a one-way arrow door, a skull, a gold coin); it
  is an inference about the exact *behaviour*. These rows are marked so nobody
  mistakes them for confirmed spec.
- **[repo]** — already written down in this repo's own README todo list, so it was
  a known target before this comparison.

Where a row is inferred, the port should treat it as a design starting point, not
gospel; the behaviour can be pinned down later against the real game.

---

## 1. Implemented today

These work in the current build (`index.js`, `collision-checking.js`, `index.html`).

| Feature | State | Where |
| --- | --- | --- |
| Tile grid rendered on screen | One fixed 9×10 screen, rendered as 90 hand-written `<img>` tags | `index.html`, `index.js` `setTile()` |
| Full original tile art available | All 147 tiles present as GIFs | `tiles/` |
| A marble that moves | Absolutely-positioned ball sprite | `index.js` `setBallPos()` |
| Momentum physics | Velocity with separate accelerating/coasting decay (`0.99` / `0.9`) and a stop threshold | `index.js` `updateBallPos()` |
| Arrow-key tilt control | Multi-key aware, sampled every 50 ms to mimic the Palm's input rate | `index.js` `keysPressed`, `keypressToTickSynchronizer()` |
| 60 fps loop scaled off the original's 20 fps | `frame-loop` at `20 × FPS_MULTIPLIER` | `index.js` |
| Wall collision, edge bounce | Bounces off the flat sides of any tile in the collision list | `collision-checking.js` |
| Edge wrapping in the collision lookup | Row/col wrap modulo the level size | `collision-checking.js` |
| One hard-coded level | A 9×10 array literal inside `index.js` | `index.js` `level` |

## 2. Missing

Ordered roughly by how much each one blocks the rest. Rows marked **done** were
picked up in the first pass of work off this list; everything else is still open.

### 2.1 The game loop itself — nothing here is a game yet

| # | Feature in the original | Status here | Source |
| --- | --- | --- | --- |
| 1 | **A goal.** The marble reaches an exit and the level is complete | **done** — tile 037 finishes the level | doc, art (tile 037) |
| 2 | **Level progression.** *"As you complete each level you are allowed to proceed to the next"* | **done** — R moves you on, and finishing the last level wins the game | doc |
| 3 | **Death and lives.** Falling in a hole/water, or hitting something deadly, costs you | **done** — three lives, deadly squares cost one | art (002 hole, 042 skull, 113 water) |
| 4 | **Restart the current level** | **done** — R, which also gives back the coins and the score for this level | doc |
| 5 | **Timer**, scaled from the original's Palm III timing | **partly** — a per-level clock counts up in the HUD; whether the original counted down, and at what rate, is still unknown | repo |
| 6 | **Score / coins.** Collectible gold coins with values | **done** — tiles 098–101, worth 1 and 5 | art (098–101) |
| 7 | **High-score table** | Not started | repo |

### 2.2 Level data

| # | Feature in the original | Status here | Source |
| --- | --- | --- | --- |
| 8 | **A level data format**, separate from code | **done** — `levels.js`, one entry per level with `name`, `start` and `tiles` | repo |
| 9 | **Hundreds of levels**, shipped as level sets | Three levels | doc |
| 10 | **Multi-screen levels.** Levels larger than one screen, scrolling/paging as the marble crosses | Single screen only | repo |
| 11 | **`.pdb` level set reading** (Palm database files) | Not started | repo |
| 12 | **`.lev` level set reading** | Not started | repo |
| 13 | **Level selector** | Not started | repo |
| 14 | **Game-pack / level-set selector** | Not started | repo |
| 15 | **Level editor** (the original shipped one) | Not started | doc |

### 2.3 Tile behaviours

Only tile `6` currently does anything at all; every other tile is decoration. The
art in `tiles/` implies at least this element vocabulary:

| # | Element | Tiles | Status | Source |
| --- | --- | --- | --- | --- |
| 16 | **Walls of several materials** — green block, stone, striped barrier, wood | 006, 011–018, 038–039, 053–089, 112 | **partly** — `tiles.js` now blocks the green block, the striped barriers, the wooden blocks and the void; the 053–089 stone textures are still unclassified | art |
| 17 | **Corner collision.** Bouncing off a wall *corner*, not just its flat side | 006 etc. | Missing — the known gap in `updateBallPos()` | repo |
| 18 | **Exit / goal** | 037 | **done** | art, doc |
| 19 | **Slippery ice** — *"slippery ice"* | 115–118 | Missing | doc, art |
| 20 | **Water** — the marble sinks | 113–114 | **partly** — classified as deadly, but nothing yet distinguishes sinking from any other death, and no level uses it | art |
| 21 | **Holes** — the marble drops through | 002, 097 | **partly** — classified as deadly, same caveat as water | art |
| 22 | **Flipper bumpers** — *"flipper bumpers"*, the marble is kicked away | 023–026, 120–123 | Missing | doc, art |
| 23 | **Teleporters** — enter one pad, leave from its partner | 040, 041, 144 | Missing | art |
| 24 | **Magnets**, attracting (`+`) and repelling (`−`) | 145, 146 | Missing | art |
| 25 | **One-way doors / arrow tiles** — passable in one direction only | 044–047, 140–143 | Missing | art |
| 26 | **Keys and locked doors** | 035, 036, 051, 052, 102 | Missing | art |
| 27 | **Switches and the doors they open** | 009, 010, 125, 126, 131, 132 | Missing | art |
| 28 | **Crumbling blocks** that break up as the marble crosses them | 133–139 | Missing | art |
| 29 | **Bombs / mines** | 048, 093, 119 | Missing | art |
| 30 | **Ramps and wedges** that deflect the marble diagonally | 019–022, 127, 128 | Missing | art |
| 31 | **Memory-game wall pieces** — pieces you trip in matching pairs | 103–110 | Missing | repo, art |
| 32 | **Extra life / pickup** (red cross) | 005 | Missing | art |
| 33 | **Mystery block** | 124 | Missing | art |
| 34 | **A second marble / hazard marble** | 090, 091, 096 | Missing | art |
| 35 | **Dice elements** | 029–034 | Missing | art |
| 36 | **Sign / note tiles** that show a level hint | 007, 008 | Missing | art |

### 2.4 Input and presentation

| # | Feature in the original | Status here | Source |
| --- | --- | --- | --- |
| 37 | **Stylus-drag tilt control** — the original's real control scheme | Arrow keys only | repo |
| 38 | **Touch/swipe control**, weighted like the stylus drag | Not started | repo |
| 39 | **Phone-sized layout** | Fixed 320×288 table, no responsive layout | repo |
| 40 | **Sound effects** | None | art (inferred from the game's nature) |
| 41 | **Menus** — new game, options, about | None | doc |

### 2.5 Repo health (not original-game features, but in the way)

| # | Item | Status |
| --- | --- | --- |
| 42 | **The test suite throws.** `tests/collision-checking.js` calls `collisionChecker(level)` with no collision-tile list, and `collision-checking.js` then dereferences `undefined.indexOf` | **done** — the collision list defaults to the green block, and the suite covers the tile registry, the level data and the game rules. `tape` was also pinned forward from 4.3.0, which dropped tests at random on modern Node |
| 43 | **The page relies on quirks mode.** No doctype, and `setBallPos()` assigns unitless numbers to `style.left`/`style.top`, which only parse because the page is in quirks mode | **done** — the page has a doctype and the positions carry `px` |
| 44 | **`build.js` is a committed bundle** that has to be rebuilt by hand after every source change | Easy to forget |

---

## 3. Suggested order of work

1. **Make it a game** — level data as data, a goal tile, death, restart, level progression, a timer and a score readout. Nothing else is worth much until a level can be won and lost. *(items 1–8, 18, 42–44)*
2. **Tile behaviours that change how you play** — ice, water, holes, one-way doors, teleporters, magnets, bumpers, crumbling blocks. *(items 19–30)*
3. **Content** — more levels, multi-screen levels, a level selector, then the `.pdb` / `.lev` readers so the original level sets can be played. *(items 9–15)*
4. **Reach** — touch control and a responsive layout, so it plays on a phone the way the original played on a Palm. *(items 37–39)*
5. **Polish** — high scores, sound, menus, the memory-game pieces and the rarer elements. *(items 7, 31–36, 40, 41)*
