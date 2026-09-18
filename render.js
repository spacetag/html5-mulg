// Builds the board out of the level grid, instead of the 90 hand-written <img>
// tags the page used to carry. Levels can now be any size.

var TILE_SIZE = 32

function tileSrc(tileNumber) {
    var padded = "00" + tileNumber
    return "tiles/tile" + padded.slice(-3) + ".gif"
}

module.exports = function createBoard(container, tileSize) {
    tileSize = tileSize || TILE_SIZE

    var images = []
    var ball = document.createElement("img")
    ball.src = "tiles/ball.png"
    ball.id = "ball"

    function draw(grid) {
        images = []
        container.innerHTML = ""

        var table = document.createElement("table")
        table.cellSpacing = 0
        table.cellPadding = 0

        grid.forEach(function(row) {
            var tr = document.createElement("tr")
            var imageRow = []

            row.forEach(function(tileNumber) {
                var td = document.createElement("td")
                var img = document.createElement("img")
                img.className = "mulg_tile"
                img.src = tileSrc(tileNumber)
                td.appendChild(img)
                tr.appendChild(td)
                imageRow.push(img)
            })

            images.push(imageRow)
            table.appendChild(tr)
        })

        container.appendChild(table)
        container.appendChild(ball)

        container.style.width = (grid[0].length * tileSize) + "px"
        container.style.height = (grid.length * tileSize) + "px"
    }

    function setTile(row, col, tileNumber) {
        images[row][col].src = tileSrc(tileNumber)
    }

    // The page used to assign unitless numbers here, which only worked because
    // the document was in quirks mode.
    function setBallPos(x, y) {
        ball.style.left = x + "px"
        ball.style.top = y + "px"
    }

    return {
        draw: draw,
        setTile: setTile,
        setBallPos: setBallPos,
        tileSrc: tileSrc
    }
}

module.exports.tileSrc = tileSrc
module.exports.TILE_SIZE = TILE_SIZE
