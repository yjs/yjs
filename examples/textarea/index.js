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
    // url: '//localhost:1234',
    url: 'https://yjs-v13.herokuapp.com/',
    // options: { transports: ['websocket'], upgrade: false }
  },
  share: {
    textarea: 'Text'
  }
}).then(function (y) {
  window.yTextarea = y

  // bind the textarea to a shared text element
  y.share.textarea.bind(document.getElementById('textfield'))
  // thats it..
})
