/* global Y */

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
