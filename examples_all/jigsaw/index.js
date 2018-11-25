/* global Y, d3 */

let y = new Y('jigsaw-example', {
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234'
  }
})

let jigsaw = y.define('jigsaw', Y.Map)
window.yJigsaw = y

var origin // mouse start position - translation of piece
var drag = d3.behavior.drag()
  .on('dragstart', function (params) {
    // get the translation of the element
    var translation = d3
      .select(this)
      .attr('transform')
      .slice(10, -1)
      .split(',')
      .map(Number)
    // mouse coordinates
    var mouse = d3.mouse(this.parentNode)
    origin = {
      x: mouse[0] - translation[0],
      y: mouse[1] - translation[1]
    }
  })
  .on('drag', function () {
    var mouse = d3.mouse(this.parentNode)
    var x = mouse[0] - origin.x // =^= mouse - mouse at dragstart + translation at dragstart
    var y = mouse[1] - origin.y
    d3.select(this).attr('transform', 'translate(' + x + ',' + y + ')')
  })
  .on('dragend', function (piece, i) {
    // save the current translation of the puzzle piece
    var mouse = d3.mouse(this.parentNode)
    var x = mouse[0] - origin.x
    var y = mouse[1] - origin.y
    jigsaw.set(piece, {x: x, y: y})
  })

var data = ['piece1', 'piece2', 'piece3', 'piece4']
var pieces = d3.select(document.querySelector('#puzzle-example')).selectAll('path').data(data)

pieces
  .classed('draggable', true)
  .attr('transform', function (piece) {
    var translation = piece.get('translation') || {x: 0, y: 0}
    return 'translate(' + translation.x + ',' + translation.y + ')'
  }).call(drag)

data.forEach(function (piece) {
  jigsaw.observe(function () {
    // whenever a property of a piece changes, update the translation of the pieces
    pieces
      .transition()
      .attr('transform', function (piece) {
        var translation = piece.get(piece)
        if (translation == null || typeof translation.x !== 'number' || typeof translation.y !== 'number') {
          translation = { x: 0, y: 0 }
        }
        return 'translate(' + translation.x + ',' + translation.y + ')'
      })
  })
})
