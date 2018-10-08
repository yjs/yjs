import { createYdbClient } from '../../ydb/index.js'
import Y from '../../src/Y.dist.js'

createYdbClient('ws://localhost:8899/ws').then(ydbclient => {
  const y = ydbclient.getY('textarea')
  let type = y.define('textarea', Y.Text)
  let textarea = document.querySelector('textarea')
  window.binding = new Y.TextareaBinding(type, textarea)
})

/*
let y = new Y('textarea-example', {
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234'
  }
})

window.yTextarea = y

// bind the textarea to a shared text element
let type = y.define('textarea', Y.Text)
let textarea = document.querySelector('textarea')
window.binding = new Y.TextareaBinding(type, textarea)
*/