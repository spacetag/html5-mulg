var NUM_OF_ROWS = 9
var NUM_OF_COLS = 10
var TILE_SIZE = 32
var BALL = document.getElementById("ball")
// http://stackoverflow.com/questions/5597060/detecting-arrow-key-presses-in-javascript
var LEFT_KEY = 37
var UP_KEY = 38
var RIGHT_KEY = 39
var DOWN_KEY = 40
var OFFSET_X = 14
var OFFSET_Y = 14

var BALL_SPEED_DECAY_ON = .99
var BALL_SPEED_DECAY_OFF = .9
var BALL_SPEED_THRESH = .1

var ballx = 0
var bally = 0
var ballsx = 0
var ballsy = 0

function getTile(row, col) {
    // https://developer.mozilla.org/en-US/docs/Web/API/Document/getElementById
    return document.getElementById(row + "_" + col)
}

function setTile(row, col, tileNum) {
    var numOfZeros = 3 - (tileNum + "").length
    var leadingZeros = ""
    for (var i = 0; i < numOfZeros; i++) {
        leadingZeros += "0"
    }
    // http://www.w3schools.com/jsref/prop_img_src.asp
    getTile(row, col).src = "tiles/tile" + leadingZeros + tileNum + ".gif"
}

function setBallPos(x, y) {
    // http://www.w3schools.com/jsref/prop_style_top.asp
    // http://stackoverflow.com/questions/2214387/setting-top-and-left-css-attributes
    BALL.style.left = ballx = x;
    BALL.style.top = bally = y;
}

function initBallPos(row, col) {
    setBallPos(col * TILE_SIZE, row * TILE_SIZE);
}

level = [[6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
[6, 4, 4, 4, 4, 4, 4, 4, 4, 6],
[6, 4, 6, 6, 6, 6, 6, 4, 6, 6],
[6, 4, 6, 4, 4, 4, 6, 4, 7, 6],
[6, 4, 4, 4, 6, 4, 6, 6, 4, 6],
[6, 6, 6, 6, 6, 4, 4, 6, 4, 6],
[6, 7, 4, 4, 6, 6, 4, 6, 4, 6],
[6, -1, 6, 4, 4, 4, 4, 6, 5, 6],
[6, 6, 6, 6, 6, 6, 6, 6, 6, 6]];

levelHeight = level.length
levelWidth = level[0].length

for(var i = 0; i < NUM_OF_ROWS; i++) {
    for(var j = 0; j < NUM_OF_COLS; j++) {
        if (level[i][j] == -1) {
            initBallPos(i, j)
            setTile(i, j, 4)
        } else {
            setTile(i, j, level[i][j])
        }
    }
}

/***** Movement *****/
// http://stackoverflow.com/questions/5597060/detecting-arrow-key-presses-in-javascript
// http://stackoverflow.com/questions/5203407/javascript-multiple-keys-pressed-at-once
var keysPressed = {37: 0, 38: 0, 39: 0, 40: 0}

document.onkeydown = function(e) {
    e = e || window.event
    // dirs = {38: [-1, 0], 40: [1, 0], 37: [0, -1], 39: [0, 1]}
    keysPressed[e.keyCode] = 1;
}

document.onkeyup = function(e) {
    e = e || window.event
    keysPressed[e.keyCode] = 0;
}

function getBallRow() {
    return (bally + OFFSET_Y) / TILE_SIZE
}

function getBallCol() {
    return (ballx + OFFSET_X) / TILE_SIZE
}

function getBallIX() {
    return (ballx + OFFSET_X) % TILE_SIZE * 16 / TILE_SIZE
}

function getBallIY() {
    return (bally + OFFSET_Y) % TILE_SIZE * 16 / TILE_SIZE
}

function checkForCollision(row, col) {
    // http://stackoverflow.com/questions/4228356/integer-division-in-javascript
    row = Math.floor((row + levelHeight) % levelHeight)
    col = Math.floor((col + levelWidth)  % levelWidth)
    if(level[row][col] == 6) return true;
    return false;
}

function updateBallPos() {
    extrax = -1 * keysPressed[LEFT_KEY] + keysPressed[RIGHT_KEY]
    extray = -1 * keysPressed[UP_KEY]   + keysPressed[DOWN_KEY]
    ballsx = (ballsx + extrax) * (extrax ? BALL_SPEED_DECAY_ON : BALL_SPEED_DECAY_OFF)
    ballsy = (ballsy + extray) * (extray ? BALL_SPEED_DECAY_ON : BALL_SPEED_DECAY_OFF)

    if ((ballsx > 0 && getBallIX() > 9 && checkForCollision(getBallRow(), getBallCol() + 1)) ||
        (ballsx < 0 && getBallIX() < 5 && checkForCollision(getBallRow(), getBallCol() - 1))) {
        ballsx = -ballsx
    }

    if ((ballsy > 0 && getBallIY() > 9 && checkForCollision(getBallRow() + 1, getBallCol())) ||
        (ballsy < 0 && getBallIY() < 5 && checkForCollision(getBallRow() - 1, getBallCol()))) {
        ballsy = -ballsy
    }

    // checkForCollision()
    // http://www.w3schools.com/jsref/jsref_abs.asp
    if (Math.abs(ballsx) < BALL_SPEED_THRESH) ballsx = 0;
    if (Math.abs(ballsy) < BALL_SPEED_THRESH) ballsy = 0;

    // console.log(ballsx, ballsy);
    setBallPos(ballx + ballsx, bally + ballsy)
}

/***** Main Game Loop *****/
// http://stackoverflow.com/questions/3138756/calling-a-function-every-60-seconds
function main() {
    updateBallPos();
}

// http://stackoverflow.com/questions/3138756/calling-a-function-every-60-seconds
setInterval(main, 50)
