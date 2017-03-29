/* global Y, CodeMirror */

// initialize a shared object. This function call returns a promise!
Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'ace-example'
  },
  sourceDir: '/bower_components',
  share: {
    codemirror: 'Text' // y.share.textarea is of type Y.Text
  }
}).then(function (y) {
  window.yCodeMirror = y

  var editor = CodeMirror(document.querySelector('#codeMirrorContainer'), {
    mode: 'javascript',
    lineNumbers: true
  })
  window.codemirror = editor
  y.share.codemirror.bindCodeMirror(editor)
})
