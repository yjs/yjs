/* global Y, Quill */

let y = new Y('quill-cursors-0', {
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234'
  }
})

let quill = new Quill('#quill-container', {
  modules: {
    toolbar: [
      [{ header: [1, 2, false] }],
      ['bold', 'italic', 'underline'],
      ['image', 'code-block'],
      [{ color: [] }, { background: [] }],    // Snow theme fills in values
      [{ script: 'sub' }, { script: 'super' }],
      ['link', 'image'],
      ['link', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }]
    ]
  },
  placeholder: 'Compose an epic...',
  theme: 'snow'  // or 'bubble'
})

let yText = y.define('quill', Y.Text)

let quillBinding = new Y.QuillBinding(yText, quill)
window.quillBinding = quillBinding
window.yText = yText
window.y = y
window.quill = quill
