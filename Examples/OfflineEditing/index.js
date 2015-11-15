/* global Y */

// create a shared object. This function call will return a promise!
Y({
  db: {
    name: 'memory',
    namespace: 'offlineEditingDemo'
  },
  connector: {
    name: 'websockets-client',
    room: 'offlineEditingDemo',
    debug: true
  },
  types: ['Array', 'Text'],
  sourceDir: '/bower_components'
}).then(function (yconfig) {
  // yconfig holds all the information about the shared object
  window.yconfig = yconfig

  // now we bind the textarea and the contenteditable h1 element
  // to a shared element
  var textarea = document.getElementById('textfield')
  yconfig.root.observePath(['text'], function (text) {
    // every time the 'text' property of the yconfig.root changes,
    // this function is called. Then we bind it to the html elements
    if (text != null) {
      // when the text property is deleted, text may be undefined!
      // This is why we have to check if text exists..
      text.bind(textarea)
    }
  })
  // create a shared Text
  var textpromise = yconfig.root.get('text')
  if (textpromise == null) {
    // Set the text type if it does not yet exist
    yconfig.root.set('text', Y.Text)
  }
})
