/* eslint-env worker */

// copy and modify this file

self.DBConfig = {
  name: 'indexeddb'
}
self.ConnectorConfig = {
  name: 'websockets-client',
  // url: '..',
  options: {
    jsonp: false
  }
}

importScripts(
  '/bower_components/yjs/y.js',
  '/bower_components/y-memory/y-memory.js',
  '/bower_components/y-indexeddb/y-indexeddb.js',
  '/bower_components/y-websockets-client/y-websockets-client.js',
  '/bower_components/y-serviceworker/yjs-sw-include.js'
)
