# The original Mulg, read from its C source

`docs/original-tiles.md` says what each tile *is*. This file says what the game
*does*: the movement model, the rules a square applies to the marble, and the
shape of the game around a level. Everything here is transcribed from Till
Harbaum's own C source, with the line it came from, so a claim can be checked
rather than taken on trust.

## Where the source is

The authoritative source is `mulg.c`, "a small action game for the palm pilot",
(c) 1998/99/00 Till Harbaum and (c) 1999 Pat Kane, GPLv2 — the same licence as
this repository. It carries its own version history from 1.0 through IIg, which
is useful in itself: "prevent marble from 'tunneling' into stone" and "wrap when
leaving game area" were both fixes in version II.

Till Harbaum's own pages (`harbaum.org`) are unreachable from this project's
build environment, and `github.com/harbaum/mulg` no longer exists. A complete
copy of the engine is vendored in the ODROID GO port, which is where the line
numbers below come from:

    git clone https://github.com/johannesbehr/mulg-go.git
    # the engine is components/mulg/

Relevant files there: `mulg.c` (the engine), `level.h` (the level struct and the
tile-name macros used in level sources), `tiles.h` lines 1–155 (the tile
constants, which agree with `docs/original-tiles.md`), `hole.c` (the marble's
overlap table), `scarab.c` (the beetle). `winc.c`, `winx.h` and `typedefs.h` are
the ODROID port's own Palm-API shim and are *not* original. The repository also
ships two genuine level databases, `level/werner.pdb` and `level/werner2.pdb`.

Line references below are `mulg.c` unless stated otherwise.

## Units, and the frame

The marble's position and speed are fixed point with an 8-bit fraction:
`marble_x >> 8` is the pixel, and a tile is 16 pixels, so **one tile is 4096
position units**. Sub-tile position is `ix = (marble_x >> 8) & 15`, in
sixteenths, and the tile is `(marble_x >> 8) / 16` plus the page offset
(`init_marble`, 861; `check_marble`, 1949).

Speeds are in the same units per frame. So a speed of 256 is one pixel a frame,
and 4096 is a whole tile a frame.

The frame rate is stated twice, and the two disagree. `PilotMain` sets
`ticks_wait = SysTicksPerSecond()/50` with the comment `// 20ms/frame` (3265),
which is 50 Hz, while each frame advances the clock by `level_time += 40` (3412),
which is 40 ms, or 25 Hz. The ODROID port kept `level_time += 40`. The likely
reading is that 50 Hz was the budget and 40 ms was what a Palm III actually
managed. **This port's `FPS_MULTIPLIER = 3 // based on 20fps` is wrong either
way.**

## Moving the marble

`move_marble`, 2277. Per frame, in order:

1. **Marble-to-marble collision**, two-player only.
2. **The move itself, sub-stepped one pixel at a time.** If `|sx| >= 256` or
   `|sy| >= 256`, the step is walked out along the dominant axis:

       if(ABS(sx) >= ABS(sy)) { step_y = 256*sy/ABS(sx); step_x = sgn(sx)*256; }
       for(r = ABS(sx/256); r > 0; r--) {
           y += step_y; if(check_marble()) { step_y = -step_y; sy = -sy; y += 2*step_y; }
           x += step_x; if(check_marble()) { step_x = -step_x; sx = -sx; x += 2*step_x; }
       }

   Each axis moves, collision is tested, and on a hit the speed is negated *and
   the position is backed out by twice the step*. The sub-pixel remainder is then
   applied the same way. This is the tunnelling fix, and it means `check_marble`
   — which is also where coins, the goal and the deadly squares are resolved —
   runs several times in a fast frame, not once.
3. **Friction**, applied unconditionally, not only while coasting:
   - on swamp: `s = s * SWAMP_SLOW/100`, `SWAMP_SLOW 50` (96)
   - on ice, or flying over space with a parachute: **no friction at all**
   - oiled: `s -= ((OIL_RELOAD - oil) * ((100-SLOW) * s / 100)) / OIL_RELOAD`
   - otherwise: `s = s * SLOW/100`, `SLOW 95` — "every step reduces marble
     energy by 5% (due to friction)" (95)

   There is no stop threshold and no speed cap. Integer truncation brings a slow
   marble to rest on its own.
4. **Tile-applied acceleration replaces speed**, it does not add to it:
   `if(marble_ax) { marble_sx = marble_ax; marble_ax = 0; }`. Only the bumper
   uses this.

### Input

`marble_push(dx, dy)`, 2474. On the Palm this is driven by the stylus, from the
pen's *movement delta* in pixels, event by event rather than once a frame
(`penMoveEvent`, 3336):

    s += ((dx << SENSE) * (OIL_RELOAD - oil)) / OIL_RELOAD / SENSE_FINE_TUNE

with `SENSE 5` and `SENSE_FINE_TUNE 1` (93–94), so a one-pixel drag is worth 32
speed units, scaled down by how fresh the oil under the marble is. A tilt sensor
feeds the same function with `tx/2`.

Push is skipped entirely while flying over space with a parachute, and **inverted
while the marble is on a reversed square** (`GND_REVERSE`, an attribute bit on
path, box and ice tiles, not a tile of its own).

There are no keys to copy for a keyboard port. The ODROID port pushes by ±2 per
frame per held direction, doubled while its A button is held (`handle_running`,
3668), which is the closest thing to a reference for what this port needs.

### Hitting a wall costs 30% of the speed

`#define DUSCH 70 // with every hit to a wall, the marble looses 30% energie`
(97). `check_marble` applies `s = s * 70/100` on the axis that hit, or on both
axes for a corner hit, before returning 1; `move_marble` then negates it. The
result of a bounce is `s_new = -(0.7 * s_old)`.

### Corners are real collisions

`hole.c` is a 16×16 table indexed by the marble's sub-tile position `[iy][ix]`.
Its top bits say which diagonal neighbours the marble overlaps at that position
(`DIR_OL 0x80`, `DIR_UL 0x40`, `DIR_UR 0x20`, `DIR_OR 0x10`, 116–119). After the
flat-side checks, `check_marble` tests those diagonals too (2260). Its low three
bits are a separate index, into `hole_acc` for the hole and hump tiles (2070).

The flat-side thresholds are `ix > 9` and `ix < 5`, which this port already
matches.

### `dir`: which side a square is entered from

`check_tile(x, y, dir, no)` is asked about a *neighbouring* square, and `dir`
says which side of it the marble is coming from, with 0 meaning "not entering
right now" (the diagram is at 2232):

        8 7 6
         \|/
        1-X-5
         /|\
        2 3 4

So 1 = from the west, 3 = from the south, 5 = from the east, 7 = from the north,
and the even numbers are the diagonals. `dir` is non-zero only at the exact entry
position: `check_tile(x+1, y, ((ix==10) && (sx>0)) ? 1 : 0, no)`. A plain wall
blocks at `dir == 0` as well; the tiles below that care about direction do not.

## What a square does

### Blocking, from `check_tile`, 1389

Always solid: `STONE`, a slot in use (`SLOT1`–`SLOT8`), the memorize tiles,
`FRATZE`, `EXCHANGE`, a broken light box, both magnets, the pushable boxes and
Hanoi pieces. A scarab is explicitly *not* solid — the marble rolls over it.

**One-ways** block only the sides they face, and only at the moment of entry, so
`dir == 0` passes through:

    OWR (45): blocked from dir 4, 5, 6   — travel rightwards only
    OWL (44): blocked from dir 1, 2, 8   — travel leftwards only
    OWU (46): blocked from dir 6, 7, 8   — travel upwards only
    OWD (47): blocked from dir 2, 3, 4   — travel downwards only

Note what is *not* there: nothing stops a marble already standing on a one-way
from leaving in any direction. This port's rule that zeroes the marble's speed
when it tries to turn back on a one-way square is an invention.

**A closed door kills you when it closes on you, not when you hit it.**
`if(dir==0) game_end(LOOSE); return 1;` (1436). Rolling into a shut door bounces;
overlapping one without entering it — which is what happens when the door slides
shut over the marble — is death. Door frames 1, 2 and 3 are shut or part-way and
deadly; frame 4 is open and safe.

**A running ventilator kills on contact** (1450), and is otherwise not solid.

**The death cube kills on contact too**: `case SKULL: game_end(LOOSE)` is in
`check_tile`, not in the standing-on switch, so touching it as a neighbour is
enough. It is also solid, so the marble can never stand on one.

**Seesaws** (`WIPPL`/`WIPPR`/`WIPPO`/`WIPPU`, 19–22) are solid except from the
one side they tip towards (1890).

**The bumper** sets `marble_ax`/`marble_ay` from `dir`, `BUMPACC 500` on a flat
side and `BUMPACCD 350` on a diagonal (106–107, 1655), and flips to its lit frame
for one animation tick.

**Boxes** need force to move: `PUSH 300` for a heavy box, `LPUSH 180` for a light
one, `HPUSH 500` for a Hanoi piece, and a light box hit harder than
`LBREAK 700` shatters instead (102–105). A box pushed into a pit fills it
(`BOXFIX`), which is how a pit is crossed. What was under a box is remembered in
its attribute byte.

**Switches and switch-like squares**, all of which call `switch_it`: the wall
switch (`SWITCH_ON`/`SWITCH_OFF`, 9/10) toggles its channel on every bump and
swaps its own two faces; a keyhole becomes a wall switch once a key is spent; a
coin slot takes a 5 first and then a 1; dice, flip tiles and the memorize tiles
fire when their whole set matches.

### Standing on a square, from `check_marble`, 1905

- `OIL` sets `marble_oil = OIL_RELOAD` (500). It counts down one per
  `check_marble`, so **oil is a state that follows the marble off the square**,
  not a property of the square: for the next several hundred frames it both
  suppresses steering and weakens friction, fading back in as it drains. This
  port's oil, a tile with `control: 0.25`, is a much milder and much more local
  thing.
- `DOC`, `KEY`, `MATCH`, `DM1`, `DM5` go into a five-slot collection and the
  square becomes floor.
- `SPACE` (an open pit) and `SWSPACE` end the level — unless the marble is
  carrying a parachute, which makes it fly over with no steering.
- A shut or part-way door under the marble ends the level.
- **`GOAL` is only won in its middle**: `if((ix>=5)&&(ix<=9)&&(iy>=5)&&(iy<=9))`
  (2029). The marble can clip the edge of the exit square and keep going. This
  port ends the level on touching the square at all, which is stricter than the
  original and is what forces a level's coins to keep clear of the exit.
- A seesaw pushes by `WIPD 0x20` and tips over when the marble passes its middle.
- Hole and hump accelerate towards or away from the centre, by
  `hole_acc[] = {0, 1, 3, 7, 15} << HOLED` with `HOLED 3` (98, 288).
- **Vanishing floors wear out.** A `VAN0`/`VAN1`/`VAN2` square, or a plain `PATH`
  square whose attribute has `0x20` set, advances one step each time the marble
  *enters it anew*, and `VAN2` becomes an open pit (2040). So a vanishing floor
  takes three crossings, and only the third kills.
- `SWAMP` sets `GND_SWAMP` for this frame, which halves the speed in
  `move_marble`.
- `ICE` sets `GND_ICE`, which removes friction. Steering is **not** reduced on
  ice — `marble_push` does not look at it.
- A floor button (`BUT0`, 88) is handled below.
- Grooves (53–68) and ramparts (69–84) pull towards or push away from the square's
  centre, per `groove_dir[16]` and the tables
  `groove_acc[] = {50,40,30,20,10,5,2,1}` and
  `rampart_acc[] = {-40,-30,-21,-15,-11,-7,-4,-2}` (217–241). The same shape of
  code drives the light box and the scarab.
- A running ventilator within one square pushes the marble by `VENT_ACC 20` per
  frame, in the direction away from it, and burns any match being carried (101,
  2226, `check_ventilator` 1299).

## Channels are toggles, not a state

`switch_it(id)`, 1330. There is no boolean per channel. Every square whose
attribute's low five bits (`ID_MASK 0x1f`, so 32 channels) equal `id` is
**toggled, independently**:

    BUT0 / BUT1 / ZERO  ->  ZERO becomes BUT1, anything else becomes BUT0
    ventilator          ->  attribute ^= ROTATING
    door                ->  attribute ^= OPENING
    PATH <-> SPACE      ->  a pit fills in, or a floor drops away

Two consequences this port does not reproduce. First, squares on one channel that
start in opposite states *stay* opposite: one pit can be open while another is
filled, and a switch swaps the two. This port drives every square on a channel to
the same form, so it would slam them together.

Second, **floor buttons are armed-or-spent, not held down**. Rolling onto a
`BUT0` marks it `ZERO` and calls `switch_it` (2010), which turns that same square
into `BUT1` — spent. `BUT1` does nothing when rolled over. What re-arms it is
another square on the same channel being pressed, since the broadcast turns every
non-`ZERO` button back into `BUT0`. So a lone floor button is a one-shot, and a
pair of them on one channel toggle back and forth. This port's floor switches are
momentary, held on only while the marble sits on them, which is a different
mechanic and one the level designs here now lean on.

A door does not jump: `do_animations` advances it one frame per four animation
ticks (2802), so roughly 160 ms a frame and about half a second end to end. This
port's `GATE_FRAME_MS` of 55 is about three times too fast.

## The game around a level

- **There are no lives.** `game_end(LOOSE)` shows "Game over." and restarts the
  level (1087). There is no life counter anywhere in the source.
- **There is no score.** The 1 and 5 coins are not points; they are collectables
  that go into the five-slot inventory and are spent at a coin slot (1567). The
  only number kept is per-level elapsed time, and the only table is a per-level
  **best time** (`save_hiscore(level_no, level_time)`, 1136). Clearing a level in
  a new best time is what unlocks the next one.
- So the clock counting up in this port is right, and both the three lives and
  the score are inventions of the port.
- The marble starts on the `PATH` square whose attribute byte is `0xff`, placed at
  `16*x + 7` — a seventh of the way into the square, not its exact centre. A level
  may hold more than one start square, for two players.
- A level is 32 bytes of name, then width and height bytes, then two bytes per
  cell, **attribute first and tile second**, row-major (`init_level`, 706).
  Maximum 37×33. No time limit is stored.
- Leaving the board wraps, in pages of 9×8 tiles overlapping by one (1917).

## What this port still gets wrong

Ordered by how much each one changes play. Items marked *(fixed)* are addressed
in the change that added this file.

1. The movement model: units, frame rate, `SLOW`/`SWAMP_SLOW` friction applied
   every frame, the oil ramp as a lingering state, and the push magnitude.
2. Sub-stepping, so a fast marble cannot pass through a wall.
3. `DUSCH`: a bounce should cost 30% of the speed.
4. Corner collision, via `hole.c`.
5. A door closing on the marble should kill it; so should touching the death cube.
6. The goal should only count in its middle. *(fixed)*
7. Channels should toggle each square independently, and floor buttons should be
   armed-or-spent rather than momentary.
8. Door frames should take about 160 ms each. *(fixed)*
9. Vanishing floors should take three crossings. *(fixed)*
10. One-ways should not restrain a marble already standing on one.
11. Lives and score are inventions; the original keeps a best time per level.
12. The forces: grooves, ramparts, holes, humps, bumpers, magnets, ventilators,
    seesaws.
13. Everything in `FEATURES.md` section 2 that is about tiles this port does not
    implement at all.
