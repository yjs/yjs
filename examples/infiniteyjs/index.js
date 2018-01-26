/* global Y */

function bindYjsInstance (y, suffix) {
  y.define('textarea', Y.Text).bind(document.getElementById('textarea' + suffix))
  y.connector.socket.on('connection', function () {
    document.getElementById('container' + suffix).removeAttribute('disconnected')
  })
  y.connector.socket.on('disconnect', function () {
    document.getElementById('container' + suffix).setAttribute('disconnected', true)
  })
}

let y1 = new Y('infinite-example', {
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234'
  }
})
window.y1 = y1
bindYjsInstance(y1, '1')

let y2 = new Y('infinite-example', {
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234'
  }
})
window.y2 = y2
bindYjsInstance(y2, '2')

let y3 = new Y('infinite-example', {
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234'
  }
})
window.y3 = y3
bindYjsInstance(y1, '3')
