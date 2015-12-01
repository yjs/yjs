/* @flow */
/* global Y, d3 */

// initialize a shared object. This function call returns a promise!
Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'Puzzle-example'
  },
  sourceDir: '/bower_components',
  share: {
    piece1: 'Map',
    piece2: 'Map',
    piece3: 'Map'
  }
}).then(function (y) {
  window.y = y

  var dragX, dragY // x,y coordinates of drag event
  var drag = d3.behavior.drag()
    .on("drag", function(){
      dragX = d3.event.x-0.05
      dragY = d3.event.y-0.05
      d3.select(this)
        //.transition()
        .attr("transform", "translate(" + dragX + "," + dragY+ ")")
    })
    .on('dragend', function (piece) {
      // change the shared model of the puzzle
      piece.set('x', dragX)
      piece.set('y', dragY)
    })

  var data = [y.share.piece1, y.share.piece2, y.share.piece3]
  var nodes = d3.select(document.querySelector("#puzzle-example")).append('g').selectAll("rect").data(data)
  nodes
    .enter()
    .append('rect')
    .attr('width', 0.1)
    .attr('height', 0.1)
    .attr("class", "cell")
    .attr("transform", function (piece, i) {
      var x = piece.get('x') || i/3
      var y = piece.get('y') || i/3
      return "translate(" + x + "," + y + ")"
    }).call(drag)
  
  function repaint () {
    nodes
      .transition()
      .attr("transform", function (piece, i) {
        var x = piece.get('x') || i/3
        var y = piece.get('y') || i/3
        return "translate(" + x + "," + y + ")"
      })
  }
  data.forEach(function(piece){
    piece.observe(repaint)
  })
})