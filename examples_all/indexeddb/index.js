/* global Y, CodeMirror */

const persistence = new Y.IndexedDB()
const connector = {
  connector: {
    name: 'websockets-client',
    room: 'codemirror-example'
  }
}

const y = new Y('codemirror-example', connector, persistence)
window.yCodeMirror = y

var editor = CodeMirror(document.querySelector('#codeMirrorContainer'), {
  mode: 'javascript',
  lineNumbers: true
})

y.define('codemirror', Y.Text).bindCodeMirror(editor)
