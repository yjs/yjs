/* global Y, d3 */

const hooks = {
  'magic-drawing': {
    fillType: function (dom, type) {
      initDrawingBindings(type, dom)
    },
    createDom: function (type) {
      const dom = document.createElement('magic-drawing')
      initDrawingBindings(type, dom)
      return dom
    }
  }
}

window.onload = function () {
  window.domBinding = new Y.DomBinding(window.yXmlType, document.body, { hooks })
}

window.addMagicDrawing = function addMagicDrawing () {
  let mt = document.createElement('magic-drawing')
  mt.setAttribute('data-yjs-hook', 'magic-drawing')
  document.body.append(mt)
}

var renderPath = d3.svg.line()
  .x(function (d) { return d[0] })
  .y(function (d) { return d[1] })
  .interpolate('basic')

function initDrawingBindings (type, dom) {
  dom.contentEditable = 'false'
  dom.setAttribute('data-yjs-hook', 'magic-drawing')
  var drawing = type.get('drawing')
  if (drawing === undefined) {
    drawing = type.set('drawing', new Y.Array())
  }
  var canvas = dom.querySelector('.drawingCanvas')
  if (canvas == null) {
    canvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    canvas.setAttribute('class', 'drawingCanvas')
    canvas.setAttribute('viewbox', '0 0 100 100')
    dom.insertBefore(canvas, null)
  }
  var clearDrawingButton = dom.querySelector('.clearDrawingButton')
  if (clearDrawingButton == null) {
    clearDrawingButton = document.createElement('button')
    clearDrawingButton.setAttribute('type', 'button')
    clearDrawingButton.setAttribute('class', 'clearDrawingButton')
    clearDrawingButton.innerText = 'Clear Drawing'
    dom.insertBefore(clearDrawingButton, null)
  }
  var svg = d3.select(canvas)
    .call(d3.behavior.drag()
      .on('dragstart', dragstart)
      .on('drag', drag)
      .on('dragend', dragend))
  // create line from a shared array object and update the line when the array changes
  function drawLine (yarray, svg) {
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
      drawLine(path, svg)
    })
  })
  // draw all existing content
  for (var i = 0; i < drawing.length; i++) {
    drawLine(drawing.get(i), svg)
  }

  // clear canvas on request
  clearDrawingButton.onclick = function () {
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
}

let y = new Y('html-editor-drawing-hook-example', {
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234'
  }
})

window.yXml = y
window.yXmlType = y.define('xml', Y.XmlFragment)
window.undoManager = new Y.utils.UndoManager(window.yXmlType, {
  captureTimeout: 500
})

document.onkeydown = function interceptUndoRedo (e) {
  if (e.keyCode === 90 && e.metaKey) {
    if (!e.shiftKey) {
      window.undoManager.undo()
    } else {
      window.undoManager.redo()
    }
    e.preventDefault()
  }
}
