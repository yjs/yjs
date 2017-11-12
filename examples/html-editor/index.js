/* global Y, HTMLElement, customElements */

class MagicTable extends HTMLElement {
  constructor () {
    super()
    var shadow = this.attachShadow({mode: 'open'})
    setTimeout(() => {
      shadow.append(this.childNodes[0])
    }, 1000)
  }
}
customElements.define('magic-table', MagicTable)

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
window.yXmlType = y.define('xml', Y.XmlFragment)
window.onload = function () {
  console.log('start!')
  // Bind children of XmlFragment to the document.body
  window.yXmlType.bindToDom(document.body)
}
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
