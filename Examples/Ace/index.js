/* global Y, ace */

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
    ace: 'Text' // y.share.textarea is of type Y.Text
  }
}).then(function (y) {
  window.yAce = y

  // bind the textarea to a shared text element
  var editor = ace.edit('aceContainer')
  editor.setTheme('ace/theme/chrome')
  editor.getSession().setMode('ace/mode/javascript')

  y.share.ace.bindAce(editor)
})
