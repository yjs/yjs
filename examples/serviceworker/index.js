/* global Y, Quill */

// register yjs service worker
if('serviceWorker' in navigator){
  // Register service worker
  // it is important to copy yjs-sw-template to the root directory!
  navigator.serviceWorker.register('./yjs-sw-template.js').then(function(reg){
    console.log("Yjs service worker registration succeeded. Scope is " + reg.scope);
  }).catch(function(err){
    console.error("Yjs service worker registration failed with error " + err);
  })
}

// initialize a shared object. This function call returns a promise!
Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'serviceworker',
    room: 'ServiceWorkerExample2'
  },
  sourceDir: '/bower_components',
  share: {
    richtext: 'Richtext' // y.share.richtext is of type Y.Richtext
  }
}).then(function (y) {
  window.yServiceWorker = y

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
