/* global Y, Quill */

// initialize a shared object. This function call returns a promise!

Y({
  db: {
    name: 'memory'
  },
  connector: {
    name: 'websockets-client',
    room: 'richtext-example-quill-1.0-test'
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