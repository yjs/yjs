/* global Y */

// initialize a shared object. This function call returns a promise!
Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234',
    room: 'html-editor-example6',
    // maxBufferLength: 100
  },
  share: {
    xml: 'XmlFragment()' // y.share.xml is of type Y.Xml with tagname "p"
  }
}).then(function (y) {
  window.yXml = y
  // Bind children of XmlFragment to the document.body
  window.yXml.share.xml.bindToDom(document.body)
})
