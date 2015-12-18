/* global Y, Quill */

// initialize a shared object. This function call returns a promise!

Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'richtext-example'
    // debug: true
    // url: 'http://127.0.0.1:2345'
  },
  sourceDir: '/bower_components',
  share: {
    richtext: 'Richtext' // y.share.richtext is of type Y.Richtext
  }
}).then(function (y) {
  window.y = y

  // bind the textarea to a shared text element
  var quill = new Quill('#editor', {
    modules: {
      'toolbar': { container: '#toolbar' }
    },
    theme: 'snow'
  })
  y.share.richtext.bind(quill)
})
