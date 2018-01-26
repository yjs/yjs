/* globals Y, d3 */

let y = new Y('drawing-example', {
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234'
  }
})

window.yDrawing = y
var drawing = y.define('drawing', Y.Array)
var renderPath = d3.svg.line()
  .x(function (d) { return d[0] })
  .y(function (d) { return d[1] })
  .interpolate('basic')

var svg = d3.select('#drawingCanvas')
  .call(d3.behavior.drag()
    .on('dragstart', dragstart)
    .on('drag', drag)
    .on('dragend', dragend))

// create line from a shared array object and update the line when the array changes
function drawLine (yarray) {
  var line = svg.append('path').datum(yarray.toArray())
  line.attr('d', renderPath)
  yarray.observe(function (event) {
    line.remove()
    line = svg.append('path').datum(yarray.toArray())
    line.attr('d', renderPath)
  })
}
// call drawLine every time an array is appended
drawing.observe(function (event) {
  event.removedElements.forEach(function () {
    // if one is deleted, all will be deleted!!
    svg.selectAll('path').remove()
  })
  event.addedElements.forEach(function (path) {
    drawLine(path)
  })
})
// draw all existing content
for (var i = 0; i < drawing.length; i++) {
  drawLine(drawing.get(i))
}

// clear canvas on request
document.querySelector('#clearDrawingCanvas').onclick = function () {
  drawing.delete(0, drawing.length)
}

var sharedLine = null
function dragstart () {
  drawing.insert(drawing.length, [Y.Array])
  sharedLine = drawing.get(drawing.length - 1)
}

// After one dragged event is recognized, we ignore them for 33ms.
var ignoreDrag = null
function drag () {
  if (sharedLine != null && ignoreDrag == null) {
    ignoreDrag = window.setTimeout(function () {
      ignoreDrag = null
    }, 10)
    sharedLine.push([d3.mouse(this)])
  }
}

function dragend () {
  sharedLine = null
  window.clearTimeout(ignoreDrag)
  ignoreDrag = null
}
