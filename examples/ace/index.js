/* global Y, ace */

let y = new Y('ace-example', {
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234'
  }
})

window.yAce = y

// bind the textarea to a shared text element
var editor = ace.edit('aceContainer')
editor.setTheme('ace/theme/chrome')
editor.getSession().setMode('ace/mode/javascript')

y.define('ace', Y.Text).bindAce(editor)
