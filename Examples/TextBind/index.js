/* global Y */

// create a shared object. This function call will return a promise!
Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'textEditingDem0',
    debug: true
  },
  types: ['Array', 'Text'],
  sourceDir: '/bower_components/'
}).then(function (yconfig) {
  // yconfig holds all the information about the shared object
  window.yconfig = yconfig
  // yconfig.root holds the shared element
  window.y = yconfig.root

  // now we bind the textarea and the contenteditable h1 element
  // to a shared element
  var textarea = document.getElementById('textfield')
  var contenteditable = document.getElementById('contenteditable')
  yconfig.root.observePath(['text'], function (text) {
    // every time the 'text' property of the yconfig.root changes,
    // this function is called. Then we bind it to the html elements
    if (text != null) {
      // when the text property is deleted, text may be undefined!
      // This is why we have to check if text exists..
      text.bind(textarea)
      text.bind(contenteditable)
    }
  })
  // create a shared Text
  yconfig.root.set('text', Y.Text)

  // We also provide a button for disconnecting/reconnecting the shared element
  var button = document.querySelector('#button')
  button.onclick = function () {
    if (button.innerText === 'Disconnect') {
      yconfig.disconnect()
      button.innerText = 'Reconnect'
    } else {
      yconfig.reconnect()
      button.innerText = 'Disconnect'
    }
  }
})
