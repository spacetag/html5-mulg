# The original Mulg tile set

The 147 GIFs in `tiles/` come from Till Harbaum's Palm OS game Mulg. This is what
each one is, taken from **MulgEd**, the Mulg game and level editor by Ilan Tayary
(<https://sourceforge.net/projects/mulged/>), whose `TileHelp.java` names and
describes every tile. MulgEd is GPLv2, the same licence as this repository, and
the descriptions below are quoted from it.

This file replaces guesswork. An earlier pass of `FEATURES.md` inferred tile
meanings from the artwork alone and got several of them wrong, so prefer this
table over anything read off a picture.

The flags come from MulgEd's own column:

| Flag | Meaning |
| --- | --- |
| B | blocking — the ball cannot pass |
| C | connectable — can be wired to a channel |
| A | activated — something else can switch it |
| R | activator — it switches something else |
| L | below — sits on top of another tile |
| I | collectable — goes into the inventory |

Tiles not listed are animation frames or unused; MulgEd gives them no
description.

Levels may be up to 37×33 tiles (`Level.MAX_WIDTH` / `MAX_HEIGHT` in MulgEd),
which is why a level can be larger than one screen.

| Tile | Name | Flags | Effect on the ball |
| --- | --- | --- | --- |
| 3 | Empty pit | A C | If the ball falls into an empty pit, the user loses. |
| 4 | Floor | A C | The ball can roll over the floor undisturbed. |
| 5 | Target cross | B | This is the goal of the level. Once the ball is on the target cross, the user has finished the level. |
| 6 | Block | B | The block is the basic wall element, which does not let the ball pass through. |
| 7 | Letter | C I | A letter tile is connected to a note which represents the text in it. The user can collect the note, then read it. |
| 9 | Switch - low | B R | Switches can activate and deactivate channels, when the ball touches them. This switch is in the low position (off). |
| 10 | Switch - high | B R | Switches can activate and deactivate channels, when the ball touches them. This switch is in the high position (on). |
| 11 | Vert. gate - closed | A C | This is a gate that can be opened. |
| 14 | Vert. gate - opened | A C | This is a gate that can be closed. |
| 15 | Horz. gate - closed | A C | This is a gate that can be opened. |
| 18 | Horz. gate - opened | A C | This is a gate that can be closed. |
| 19 | Swing from left |  | The swing lets the ball go through only from one side to the other, and then back. |
| 20 | Swing from right |  | The swing lets the ball go through only from one side to the other, and then back. |
| 21 | Swing from up |  | The swing lets the ball go through only from one side to the other, and then back. |
| 22 | Swing from down |  | The swing lets the ball go through only from one side to the other, and then back. |
| 23 | Inactive Ventilator | A C | The ventilator, if active, sucks the ball into it and the user looses |
| 27 | Hole |  | The hole in the ground pulls the ball towards its center. |
| 28 | Bump |  | The bump interferes with the ball's movement by pushing it away from its center. |
| 29 | Die - 1 | C R | A die is rolled when the ball touches it. The number on the dice is then selected randomly. |
| 30 | Die - 2 | C R | A die is rolled when the ball touches it. The number on the dice is then selected randomly. |
| 31 | Die - 3 | C R | A die is rolled when the ball touches it. The number on the dice is then selected randomly. |
| 32 | Die - 4 | C R | A die is rolled when the ball touches it. The number on the dice is then selected randomly. |
| 33 | Die - 5 | C R | A die is rolled when the ball touches it. The number on the dice is then selected randomly. |
| 34 | Die - 6 | C R | A die is rolled when the ball touches it. The number on the dice is then selected randomly. |
| 35 | Key | I | A key can be used to open locks and turn them into switches. |
| 37 | Lock | C R | The lock is turned into a switch when the ball touches it and a key is in the inventory. |
| 38 | Heavy box | L | The heavy box can be pushed onto a nearby floor, or into a nearby empty/switch pit |
| 39 | Heavy box in place |  | This is what a heavy box looks like when it is pushed into an empty space. |
| 40 | Bouncer |  | The bouncer causes an effect like pinbal. It bounces the ball when the ball hits it. |
| 42 | Death cube |  | Oooohh. This tile can cause the user to loose the level if the ball touches it |
| 43 | Icy floor |  | The icy floor is slippery, so no friction slows down the ball |
| 44 | One-way left |  | This tile does not let the ball go back against the direction of the arrow |
| 45 | One-way right |  | This tile does not let the ball go back against the direction of the arrow |
| 46 | One-way up |  | This tile does not let the ball go back against the direction of the arrow |
| 47 | One-way down |  | This tile does not let the ball go back against the direction of the arrow |
| 48 | Bomb | C | A bomb on the floor can be lit if there is a match in the inventory |
| 51 | Match | C | The match is used to light up bombs |
| 53 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 54 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 55 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 56 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 57 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 58 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 59 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 60 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 61 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 62 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 63 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 64 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 65 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 66 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 67 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 68 | Groove |  | This is like a tunnel. It pulls the ball towards its center |
| 69 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 70 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 71 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 72 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 73 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 74 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 75 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 76 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 77 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 78 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 79 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 80 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 81 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 82 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 83 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 84 | Rampart |  | This is like a raised platform. It pushes the ball away from its center |
| 85 | Descending floor x2 |  | This is an unstable floor. The ball can pass on it 2 more times. On the third time it turns into an empty pit and the user loses |
| 86 | Descending floor x1 |  | This is an unstable floor. The ball can pass on it one more time. On the second time it turns into an empty pit and the user loses |
| 87 | Descending floor x0 |  | This is an unstable floor. The ball can not pass on it any more. If the user tries, it turns into an empty pit and the user loses |
| 88 | Floor switch - up | C R | This is a switch that is hidden as a floor. When the ball presses it, It activates. |
| 89 | Floor switch - down | C R | This is what the floor switch looks like when it is pressed. |
| 90 | Flip - on | R | This is a flip tile. It is connected to an X and a Y channel. It flips on/off when the ball touches it. |
| 91 | Flip - off | R | This is a flip tile. It is connected to an X and a Y channel. It flips on/off when the ball touches it. |
| 92 | Bomb dispenser |  | This is a dispenser of bombs. Each time the ball touches it, a bomb is added to the inventory. |
| 94 | Smiley |  | This is a nice decoration and can be used for the plot. |
| 95 | Parachute | I | The parachute enables the ball to hover above empty pits, however, the user does not have control over the ball's direction when it hovers. |
| 98 | Coin - 1 | I | The 1 cent coin can activate a coin-slot tile |
| 100 | Coin - 5 |  | The 5 cent coin can activate a coin-slot tile |
| 102 | Coin slot | C R | The coin slot can be activated using a coin |
| 111 | Oil |  | If the ball rolls on an oil stain, it will get very slippery and remain that way until all the oil comes off |
| 112 | Mud |  | The mud slows down the ball to a stop almost immediately |
| 113 | Light box | L | This is the light version of the heavy box. If it gets hit too hard, it'll break apart |
| 114 | Light box in place |  | This is what the light box looks like when it is pushed into a pit. |
| 119 | Switch pit | C R | This is a pit that activates its channel when a box is pushed inside |
| 120 | Scarab beatle | L | These bugs go around and chase the ball. They try to push the ball around the level |
| 121 | Scarab beatle | L | These bugs go around and chase the ball. They try to push the ball around the level |
| 122 | Scarab beatle | L | These bugs go around and chase the ball. They try to push the ball around the level |
| 123 | Scarab beatle | L | These bugs go around and chase the ball. They try to push the ball around the level |
| 133 | Hanoi tower - Bottom | B C R | The ball can push smaller tower pieces onto larger ones, and then detach the two by pushing the smaller piece away from the larger one. |
| 134 | Hanoi tower - Middle | B C R | The ball can push smaller tower pieces onto larger ones, and then detach the two by pushing the smaller piece away from the larger one. |
| 135 | Hanoi tower - Top | B C R | The ball can push smaller tower pieces onto larger ones, and then detach the two by pushing the smaller piece away from the larger one. |
| 136 | Hanoi tower - Bottom and Middle | B C R | The ball can push smaller tower pieces onto larger ones, and then detach the two by pushing the smaller piece away from the larger one. |
| 137 | Hanoi tower - Bottom and Top | B C R | The ball can push smaller tower pieces onto larger ones, and then detach the two by pushing the smaller piece away from the larger one. |
| 138 | Hanoi tower - Moddle and Top | B C R | The ball can push smaller tower pieces onto larger ones, and then detach the two by pushing the smaller piece away from the larger one. |
| 139 | Hanoi tower - Bottom, Middle and Top | B C R | The ball can push smaller tower pieces onto larger ones, and then detach the two by pushing the smaller piece away from the larger one. |
| 140 | Walker - right | B L | These tiles go "Walking" in one direction. |
| 141 | Walker - down | B L | These tiles go "Walking" in one direction. |
| 142 | Walker - left | B L | These tiles go "Walking" in one direction. |
| 143 | Walker - up | B L | These tiles go "Walking" in one direction. |
| 144 | Exchange | B | This is a nice decoration and can be used for the plot |
| 145 | Magnet - positive | B | This magnet pulls the ball towards it. The closer the ball, the harder the pull |
| 146 | Magnet - netgative | B | This magnet pushes the ball away from it. The closer the ball, the harder the push |

## The level format

Also from MulgEd, and worth knowing before the `.lev` / `.pdb` readers get
written:

- A level is a **name, a width, a height and a grid of cells**. There is **no
  time limit stored in a level**, so a countdown is not something the level data
  asks for.
- A cell is **two bytes: a tile number and a data byte**.
- For a connectable tile, the low five bits of the data byte are its **channel,
  0 to 31** (`CT_CONNECTABLE`, "user can connect to channel (0..31)"), and bit
  `0x80` marks the activated state — an open gate is the closed gate's tile with
  that bit set.
- The data byte also carries a few special cases on otherwise ordinary tiles: on
  a floor tile, `0xff` marks the **level's starting point**, `0x20` a descending
  floor with three crossings left, and `0x40` / `0x80` the reverser pair.
- A screen is **9 tiles across and 8 down, overlapping by one**: MulgEd sizes a
  level as `screens × 9 + 1` by `screens × 8 + 1`, so a one-screen level is 10×9
  tiles. That is exactly the board this port draws.

## Notes that do not fit the table

- **Switches and channels.** Switches (009/010), floor switches (088/089), flip
  tiles (090/091), locks (037), coin slots (102), dice (029–034) and switch pits
  (119) are *activators*; gates (011–018), pits and floors (003/004) and the
  ventilator (023) are *activated*. They are wired together into channels, which
  is how a level builds its puzzles.
- **Inventory.** The ball carries things: keys (035), matches (051), bombs from a
  dispenser (092), letters (007) and the parachute (095).
- **There are no teleporters in Mulg.** Tile 040 is a pinball bouncer and tile
  144 is decoration.

