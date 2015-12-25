module.exports = function makeCollisionCheckingFunction(level) {
	var levelHeight = level.length
	var levelWidth = level[0].length

	return function checkForCollision(row, col) {
	    // http://stackoverflow.com/questions/4228356/integer-division-in-javascript
	    row = Math.floor((row + levelHeight) % levelHeight)
	    col = Math.floor((col + levelWidth)  % levelWidth)

	    return level[row][col] == 6
	}
}
