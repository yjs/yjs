/* global Y, monaco */

require.config({ paths: { 'vs': '../node_modules/monaco-editor/min/vs' } })

let y = new Y('monaco-example', {
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234'
  }
})

require(['vs/editor/editor.main'], function () {
  window.yMonaco = y

  // Create Monaco editor
  var editor = monaco.editor.create(document.getElementById('monacoContainer'), {
    language: 'javascript'
  })

  // Bind to y.share.monaco
  y.define('monaco', Y.Text).bindMonaco(editor)
})
