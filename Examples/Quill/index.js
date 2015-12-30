/* global Y, Quill */

// initialize a shared object. This function call returns a promise!

Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'richtext-example18',
    debug: true
    //url: 'http://127.0.0.1:1234'
  },
  sourceDir: '/bower_components',
  share: {
    richtext: 'Richtext' // y.share.richtext is of type Y.Richtext
  }
}).then(function (y) {
  window.yquill = y

  // create quill element
  window.quill = new Quill('#editor', {
    modules: {
      'toolbar': { container: '#toolbar' },
      'link-tooltip': true
    },
    theme: 'snow'
  })
  // bind quill to richtext type
  y.share.richtext.bind(window.quill)
})
