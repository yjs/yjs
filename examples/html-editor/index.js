/* global Y */

// initialize a shared object. This function call returns a promise!
let y = new Y({
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234',
    room: 'html-editor-example6'
    // maxBufferLength: 100
  }
})
window.yXml = y
window.yXmlType = y.get('xml', Y.XmlFragment)
window.onload = function () {
  console.log('start!')
  // Bind children of XmlFragment to the document.body
  window.yXmlType.bindToDom(document.body)
}
window.undoManager = new Y.utils.UndoManager(window.yXmlType)

document.onkeydown = function interceptUndoRedo (e) {
  if (e.keyCode === 90 && e.ctrlKey) {
    if (!e.shiftKey) {
      console.info('Undo!')
      window.undoManager.undo()
    } else {
      console.info('Redo!')
      window.undoManager.redo()
    }
    e.preventDefault()
  }
}
