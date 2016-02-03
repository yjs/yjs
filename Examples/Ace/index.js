/* global Y, ace */

// initialize a shared object. This function call returns a promise!
Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'ace-example-dev'
    // debug: true
    // url: 'http://127.0.0.1:2345'
  },
  sourceDir: '/bower_components',
  share: {
    ace: 'Text' // y.share.textarea is of type Y.Text
  }
}).then(function (y) {
  window.y = y

  // bind the textarea to a shared text element
  var editor = ace.edit('editor')
  editor.setTheme('ace/theme/monokai')
  editor.getSession().setMode('ace/mode/javascript')

  y.share.ace.bindAce(editor)
  // thats it..
})
