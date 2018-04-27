/* global Y */

let y = new Y('xml-example', {
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234'
  }
})

window.yXml = y
// bind xml type to a dom, and put it in body
window.sharedDom = y.define('xml', Y.XmlElement).toDom()
document.body.appendChild(window.sharedDom)
