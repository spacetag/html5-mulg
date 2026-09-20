# The original Mulg level databases

These are the level sets the original Palm game shipped with, copied unchanged
from Till Harbaum's own Mulg source tree at
<https://github.com/harbaum/palmos/tree/master/mulg>.

| file | set | levels | author |
| --- | --- | --- | --- |
| `mulg.pdb` | Classic Mulg | 16 | Till Harbaum |
| `mulg2.pdb` | The story goes on | 16 | Till Harbaum |
| `mulg3.pdb` | The next chapter | 16 | Pat Kane and Till Harbaum |

Each is a PalmOS database: a header, a chunk of game flags, a chunk holding the
author and the notes the letters carry, and then one chunk per level.
`tools/mulg-pdb.js` reads that format and `tools/convert-levels.js` turns it into
`levels-original.js`; `npm run levels` does both. Nothing here is edited by hand,
and nothing here should be - if a level looks wrong, the conversion is wrong.

The same tree carries two more databases this port does not include: `test.pdb`,
the debug set, and `Barking.pdb`, a set by Jim Cromwell rather than part of the
game. Both convert fine if you drop them in this directory. `test.pdb` is a
`LevP` database, the newer type that carries a record of custom tile art before
its levels; `tools/mulg-pdb.js` skips that record the way `mulg.c` does, but the
port draws such a set with the standard tiles.

Mulg II is copyright 1998-2001 Till Harbaum, Pat Kane and Tomoto Shimizu, and is
distributed under the GNU General Public License version 2 or later, which is
also this port's licence. The levels and their notes are their work.
