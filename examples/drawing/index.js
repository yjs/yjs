/* globals Y, d3 */
'strict mode'

Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'drawing-example'
    // url: 'localhost:1234'
  },
  sourceDir: '/bower_components',
  share: {
    drawing: 'Array'
  }
}).then(function (y) {
  window.yDrawing = y
  var drawing = y.share.drawing
  var renderPath = d3.svg.line()
    .x(function (d) { return d[0] })
    .y(function (d) { return d[1] })
    .interpolate('basis')

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
      // we only implement insert events that are appended to the end of the array
      event.values.forEach(function (value) {
        line.datum().push(value)
      })
      line.attr('d', renderPath)
    })
  }
  // call drawLine every time an array is appended
  y.share.drawing.observe(function (event) {
    if (event.type === 'insert') {
      event.values.forEach(drawLine)
    } else {
      // just remove all elements (thats what we do anyway)
      svg.selectAll('path').remove()
    }
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
      }, 33)
      sharedLine.push([d3.mouse(this)])
    }
  }

  function dragend () {
    sharedLine = null
    window.clearTimeout(ignoreDrag)
    ignoreDrag = null
  }
})
