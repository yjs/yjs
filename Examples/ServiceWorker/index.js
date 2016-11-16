/* global Y, Quill */

var connector, serviceworker

// register yjs service worker
if ('serviceWorker' in navigator) {
  // service worker is supported by the browser
  connector = 'serviceworker'
  serviceworker = navigator.serviceWorker.register('../bower_components/y-serviceworker/yjs-service-worker.js')
} else {
  // use websockets for browsers that do not support service browser
  connector = 'websockets-client'
}

// initialize a shared object. This function call returns a promise!
Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: connector,
    serviceworker: serviceworker,
    room: 'ServiceWorkerExample2'
  },
  sourceDir: '/bower_components',
  share: {
    richtext: 'Richtext' // y.share.richtext is of type Y.Richtext
  }
}).then(function (y) {
  window.yQuill = y

  // create quill element
  window.quill = new Quill('#quill', {
    modules: {
      formula: true,
      syntax: true,
      toolbar: [
        [{ size: ['small', false, 'large', 'huge'] }],
        ['bold', 'italic', 'underline'],
        [{ color: [] }, { background: [] }],    // Snow theme fills in values
        [{ script: 'sub' }, { script: 'super' }],
        ['link', 'image'],
        ['link', 'code-block'],
        [{list: 'ordered' }]
      ]
    },
    theme: 'snow'
  })
  // bind quill to richtext type
  y.share.richtext.bind(window.quill)
})