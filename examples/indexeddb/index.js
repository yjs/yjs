/* global Y, CodeMirror */

const persistence = new Y.IndexedDB()
const connector = {
  connector: {
    name: 'websockets-client',
    room: 'codemirror-example'
  }
}
// initialize a shared object. This function call returns a promise!
const y = Y('codemirror-example', connector, persistence)
window.yCodeMirror = y

var editor = CodeMirror(document.querySelector('#codeMirrorContainer'), {
  mode: 'javascript',
  lineNumbers: true
})
y.share.codemirror.bindCodeMirror(editor)
