importScripts(
  '/bower_components/yjs/y.js',
  '/bower_components/y-memory/y-memory.js',
  '/bower_components/y-indexeddb/y-indexeddb.js',
  '/bower_components/y-websockets-client/y-websockets-client.js'
)

Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'ServiceWorkerExample',
    options: { jsonp: false }
  }
}).then(function (y) {
  console.log('y sw init')
})

addEventListener('message', function () {
  console.log.apply(console, ['sw received:'].concat(arguments))
}, true)