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
window.onload = function () {
  console.log('start!')
  // Bind children of XmlFragment to the document.body
  y.get('xml', Y.XmlFragment).bindToDom(document.body)
}
