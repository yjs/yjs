/* global Y */

// eslint-disable-next-line
let search = new URLSearchParams(location.search)
let url = search.get('url')

// initialize a shared object. This function call returns a promise!
Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'Textarea-example',
    url: url || 'http://127.0.0.1:1234'
  },
  sourceDir: '/bower_components',
  share: {
    textarea: 'Text', // y.share.textarea is of type Y.Text
    test: 'Array'
  }
}).then(function (y) {
  window.yTextarea = y

  // bind the textarea to a shared text element
  y.share.textarea.bind(document.getElementById('textfield'))
  // thats it..
})
