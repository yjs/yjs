/* global Y */

window.onload = function () {
  window.yXmlType.bindToDom(document.body)
}

let persistence = null //  new Y.IndexedDBPersistence()

// initialize a shared object. This function call returns a promise!
let y = new Y({
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234',
    room: 'x'
    // maxBufferLength: 100
  }
}, persistence)
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
