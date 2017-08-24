/* global Y */

// initialize a shared object. This function call returns a promise!
Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    // url: 'http://127.0.0.1:1234',
    url: 'http://192.168.178.81:1234',
    room: 'Xml-example'
  },
  sourceDir: '/bower_components',
  share: {
    xml: 'Xml("p")' // y.share.xml is of type Y.Xml with tagname "p"
  }
}).then(function (y) {
  window.yXml = y
  // bind xml type to a dom, and put it in body
  window.sharedDom = y.share.xml.getDom()
  document.body.appendChild(window.sharedDom)
})
