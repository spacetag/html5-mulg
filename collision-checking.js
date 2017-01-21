module.exports = function makeCollisionCheckingFunction(level, collisionTiles) {
	var levelHeight = level.length
	var levelWidth = level[0].length

	return function checkForCollision(row, col) {
		// http://stackoverflow.com/questions/4228356/integer-division-in-javascript
		row = Math.floor((row + levelHeight) % levelHeight)
		col = Math.floor((col + levelWidth)  % levelWidth)

		return collisionTiles.indexOf(level[row][col]) !== -1
	}
}
