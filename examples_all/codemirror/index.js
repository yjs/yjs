/* global Y, CodeMirror */

let y = new Y('codemirror-example', {
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234'
  }
})

window.yCodeMirror = y

var editor = CodeMirror(document.querySelector('#codeMirrorContainer'), {
  mode: 'javascript',
  lineNumbers: true
})
y.define('codemirror', Y.Text).bindCodeMirror(editor)
