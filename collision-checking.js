var DEFAULT_COLLISION_TILES = [ 6 ]

// `blocks` is either a list of tile numbers that stop the marble, or a predicate
// taking a tile number. Left out, it falls back to the green block, which is the
// only wall this game knew about originally.
module.exports = function makeCollisionCheckingFunction(level, blocks) {
    var levelHeight = level.length
    var levelWidth = level[0].length

    if (blocks === undefined) blocks = DEFAULT_COLLISION_TILES

    var blocksTile = typeof blocks === 'function' ? blocks : function(tileNumber) {
        return blocks.indexOf(tileNumber) !== -1
    }

    // `entering` is which way the ball is heading into the square, as a pair of
    // -1/0/1 components, for tiles like the one-way arrows that only block from
    // one side. It is null when the ball is already overlapping the square rather
    // than rolling into it, which mulg.c distinguishes and some tiles care about.
    // A list of tile numbers ignores it.
    return function checkForCollision(row, col, entering) {
        // http://stackoverflow.com/questions/4228356/integer-division-in-javascript
        row = Math.floor((row + levelHeight) % levelHeight)
        col = Math.floor((col + levelWidth)  % levelWidth)

        return blocksTile(level[row][col], entering)
    }
}
