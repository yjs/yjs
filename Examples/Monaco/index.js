/* global Y */

require.config({ paths: { 'vs': '../node_modules/monaco-editor/min/vs' }})
require(['vs/editor/editor.main'], function() {

  // Initialize a shared object. This function call returns a promise!
  Y({
    db: {
      name: 'memory'
    },
    connector: {
      name: 'websockets-client',
      room: 'monaco-example'
    },
    sourceDir: '/bower_components',
    share: {
      monaco: 'Text' // y.share.monaco is of type Y.Text
    }
  }).then(function (y) {
    window.yMonaco = y

    // Create Monaco editor
    var editor = monaco.editor.create(document.getElementById('monacoContainer'), {
      language: 'javascript'
    })

    // Bind to y.share.monaco
    y.share.monaco.bindMonaco(editor)
  })
})

