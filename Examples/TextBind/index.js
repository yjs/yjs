/* global Y */

Y({
  db: {
    name: 'Memory'
  },
  connector: {
    name: 'WebRTC',
    room: 'mineeeeeee',
    debug: true
  }
}).then(function (yconfig) {
  window.y = yconfig.root
  window.yconfig = yconfig
  var textarea = document.getElementById('textfield')
  var contenteditable = document.getElementById('contenteditable')
  yconfig.root.observePath(['text'], function (text) {
    if (text != null) {
      text.bind(textarea)
      text.bind(contenteditable)
      window.ytext = text
    }
  })
  yconfig.root.set('text', Y.TextBind)
})
