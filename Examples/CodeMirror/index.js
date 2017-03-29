/* global Y, CodeMirror */

// initialize a shared object. This function call returns a promise!
Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'codemirror-example'
  },
  sourceDir: '/bower_components',
  share: {
    codemirror: 'Text' // y.share.codemirror is of type Y.Text
  }
}).then(function (y) {
  window.yCodeMirror = y

  var editor = CodeMirror(document.querySelector('#codeMirrorContainer'), {
    mode: 'javascript',
    lineNumbers: true
  })
  y.share.codemirror.bindCodeMirror(editor)
})
