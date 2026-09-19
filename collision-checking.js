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

    // `direction` is which way the ball is heading into the square, for tiles
    // like the one-way arrows that only block from one side. A list of tile
    // numbers ignores it.
    return function checkForCollision(row, col, direction) {
        // http://stackoverflow.com/questions/4228356/integer-division-in-javascript
        row = Math.floor((row + levelHeight) % levelHeight)
        col = Math.floor((col + levelWidth)  % levelWidth)

        return blocksTile(level[row][col], direction)
    }
}
