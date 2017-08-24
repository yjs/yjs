/* global Y */

Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'Textarea-example',
    url: 'https://yjs-v13.herokuapp.com/'
  },
  share: {
    textarea: 'Text'
  }
}).then(function (y) {
  window.y1 = y
  y.share.textarea.bind(document.getElementById('textarea1'))
})

Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'Textarea-example',
    url: 'https://yjs-v13-second.herokuapp.com/'
  },
  share: {
    textarea: 'Text'
  }
}).then(function (y) {
  window.y2 = y
  y.share.textarea.bind(document.getElementById('textarea2'))
  y.connector.socket.on('connection', function () {
    document.getElementById('container2').removeAttribute('disconnected')
  })
  y.connector.socket.on('disconnect', function () {
    document.getElementById('container2').setAttribute('disconnected', true)
  })
})

Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'Textarea-example',
    url: 'https://yjs-v13-third.herokuapp.com/'
  },
  share: {
    textarea: 'Text'
  }
}).then(function (y) {
  window.y3 = y
  y.share.textarea.bind(document.getElementById('textarea3'))
  y.connector.socket.on('connection', function () {
    document.getElementById('container3').removeAttribute('disconnected')
  })
  y.connector.socket.on('disconnect', function () {
    document.getElementById('container3').setAttribute('disconnected', true)
  })
})
