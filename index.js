// Wiring: keyboard in, board and HUD out. The rules live in game.js.

var frameLoop = require('frame-loop')
var createBoard = require('./render')
var createGame = require('./game')
var levels = require('./levels')

var TILE_SIZE = createGame.TILE_SIZE
var FPS_MULTIPLIER = createGame.FPS_MULTIPLIER

// http://stackoverflow.com/questions/5597060/detecting-arrow-key-presses-in-javascript
var KEY_TO_DIRECTION = {
    37: 'left',
    38: 'up',
    39: 'right',
    40: 'down'
}
var RESTART_KEY = 82 // r
// Not in the help line, and not a button: the marble going see-through is the
// only sign this key is here.
var GHOST_KEY = 87 // w

// What the speed button steps through. A step runs the whole simulation one
// more time per frame, so at 2x the marble, the switches and the clock all move
// at twice the rate and the game plays exactly as it does at 1x, only quicker.
var SPEEDS = [ 1, 2 ]
var speedIndex = 0

var game = createGame(levels)
var board = createBoard(document.getElementById("board"), TILE_SIZE)

var levelSelect = document.getElementById("level_select")
var speedButton = document.getElementById("speed_button")

var hud = {
    level: document.getElementById("hud_level"),
    time: document.getElementById("hud_time"),
    score: document.getElementById("hud_score"),
    lives: document.getElementById("hud_lives"),
    message: document.getElementById("message")
}

var notesUi = {
    note: document.getElementById("note"),
    toggle: document.getElementById("notes_toggle"),
    list: document.getElementById("notes_list")
}

// Rebuilt only when a note is picked up, not every frame.
var notesShown = -1

notesUi.toggle.onclick = function() {
    var open = notesUi.list.style.display === "block"
    notesUi.list.style.display = open ? "none" : "block"
    // The panel above holds the newest note, so hide it while the full list is
    // up rather than printing that note twice.
    notesUi.note.style.display = open && game.lastNote ? "block" : "none"
    notesUi.toggle.blur()
}

function formatTime(ms) {
    var totalSeconds = Math.floor(ms / 1000)
    var minutes = Math.floor(totalSeconds / 60)
    var seconds = totalSeconds % 60
    return minutes + ":" + ("0" + seconds).slice(-2)
}

function drawLevel() {
    board.draw(game.grid)
    board.setBallGhost(game.ghost)
    hud.level.textContent = (game.levelIndex + 1) + "/" + levels.length + " " + game.level.name
    notesShown = -1
    notesUi.list.style.display = "none"
    // The level also moves on by being played, so the selector follows the game
    // rather than the other way round.
    levelSelect.value = String(game.levelIndex)
}

// The newest note is shown as it is picked up; the button brings back the ones
// already read.
function drawNotes() {
    if (game.notes.length === notesShown) return
    notesShown = game.notes.length

    notesUi.note.textContent = game.lastNote || ""
    notesUi.note.style.display = game.lastNote && notesUi.list.style.display !== "block" ? "block" : "none"

    notesUi.toggle.textContent = "Notes (" + game.notes.length + ")"
    notesUi.toggle.style.display = game.notes.length ? "inline-block" : "none"

    notesUi.list.innerHTML = ""

    game.notes.forEach(function(text) {
        var item = document.createElement("li")
        item.textContent = text
        notesUi.list.appendChild(item)
    })
}

function drawHud() {
    hud.time.textContent = formatTime(game.elapsedMs)
    hud.score.textContent = game.score
    hud.lives.textContent = game.lives
    hud.message.textContent = game.message
    hud.message.style.visibility = game.message ? "visible" : "hidden"
}

/***** Controls *****/

// Every level is listed, not just the ones reached: this is a port to poke at,
// and hunting for a level behind fourteen others is no fun.
levels.forEach(function(level, index) {
    var option = document.createElement("option")
    option.value = String(index)
    option.textContent = (index + 1) + ". " + level.name
    levelSelect.appendChild(option)
})

levelSelect.onchange = function() {
    game.goToLevel(Number(levelSelect.value))
    drawLevel()
    drawHud()
    board.setBallPos(game.ball.x, game.ball.y)
    // Otherwise the arrow keys would go on steering the list instead of the
    // marble.
    levelSelect.blur()
}

function drawSpeed() {
    speedButton.textContent = "Speed " + SPEEDS[speedIndex] + "\u00d7"
}

speedButton.onclick = function() {
    speedIndex = (speedIndex + 1) % SPEEDS.length
    drawSpeed()
    speedButton.blur()
}

/***** Input *****/
// http://stackoverflow.com/questions/5203407/javascript-multiple-keys-pressed-at-once

document.onkeydown = function(e) {
    e = e || window.event
    var direction = KEY_TO_DIRECTION[e.keyCode]

    if (direction) {
        game.input[direction] = true
        e.preventDefault()
    }
}

document.onkeyup = function(e) {
    e = e || window.event
    var direction = KEY_TO_DIRECTION[e.keyCode]

    if (direction) game.input[direction] = false

    if (e.keyCode === RESTART_KEY) {
        game.advance()
        drawLevel()
        drawHud()
    }

    if (e.keyCode === GHOST_KEY) board.setBallGhost(game.toggleGhost())
}

/***** Main Game Loop *****/

function main(elapsedMsSinceLastTick) {
    for (var step = 0; step < SPEEDS[speedIndex]; step++) game.tick(elapsedMsSinceLastTick)

    game.consumeTileChanges().forEach(function(change) {
        board.setTile(change.row, change.col, change.tile)
    })

    board.setBallPos(game.ball.x, game.ball.y)
    drawHud()
    drawNotes()
}

drawSpeed()
drawLevel()
drawHud()
drawNotes()
board.setBallPos(game.ball.x, game.ball.y)

var engine = frameLoop({
    fps: 20 * FPS_MULTIPLIER
}, main)

engine.run()
