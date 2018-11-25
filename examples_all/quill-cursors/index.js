/* global Y, Quill, QuillCursors */

Quill.register('modules/cursors', QuillCursors)

let y = new Y('quill-0', {
  connector: {
    name: 'websockets-client',
    url: 'http://127.0.0.1:1234'
  }
})
let users = y.define('users', Y.Array)
let myUserInfo = new Y.Map()
myUserInfo.set('name', 'dada')
myUserInfo.set('color', 'red')
users.push([myUserInfo])

let quill = new Quill('#quill-container', {
  modules: {
    toolbar: [
      [{ header: [1, 2, false] }],
      ['bold', 'italic', 'underline'],
      ['image', 'code-block'],
      [{ color: [] }, { background: [] }], // Snow theme fills in values
      [{ script: 'sub' }, { script: 'super' }],
      ['link', 'image'],
      ['link', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }]
    ],
    cursors: {
      hideDelay: 500
    }
  },
  placeholder: 'Compose an epic...',
  theme: 'snow' // or 'bubble'
})

let cursors = quill.getModule('cursors')

const drawCursors = () => {
  cursors.clearCursors()
  users.map((user, userId) => {
    if (user !== myUserInfo) {
      let relativeRange = user.get('range')
      let lastUpdated = new Date(user.get('last updated')).getTime()
      if (lastUpdated != null && new Date().getTime() - lastUpdated < 20000 && relativeRange != null) {
        let start = Y.utils.fromRelativePosition(y, relativeRange.start).offset
        let end = Y.utils.fromRelativePosition(y, relativeRange.end).offset
        let range = { index: start, length: end - start }
        cursors.setCursor(userId + '', range, user.get('name'), user.get('color'))
      }
    }
  })
}

users.observeDeep(drawCursors)
drawCursors()

quill.on('selection-change', function (range) {
  if (range != null) {
    myUserInfo.set('range', {
      start: Y.utils.getRelativePosition(yText, range.index),
      end: Y.utils.getRelativePosition(yText, range.index + range.length)
    })
  } else {
    myUserInfo.delete('range')
  }
  myUserInfo.set('last updated', new Date().toString())
})

let yText = y.define('quill', Y.Text)
let quillBinding = new Y.QuillBinding(yText, quill)

window.quillBinding = quillBinding
window.yText = yText
window.y = y
window.quill = quill
window.users = users
window.cursors = cursors
