/* global Y, Quill */

// initialize a shared object. This function call returns a promise!

Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'ServiceWorkerExample'
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
  });
  // bind quill to richtext type
  y.share.richtext.bind(window.quill)
})

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./yjs-service-worker.js').then(function(registration) {
    // Registration was successful
    console.log('Yjs ServiceWorker registration successful with scope: ', registration.scope)
    registration.active.postMessage('hi sw')
    addEventListener('message', function () {console.log.apply(console, ['host received:'].concat(arguments))}, true)
  }).catch(function(err) {
    // registration failed :(
    console.log('Yjs ServiceWorker registration failed: ', err)
  });
}