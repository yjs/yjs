/* eslint-env browser */

import { createYdbClient } from '../../YdbClient/index.js'
import Y from '../../src/Y.dist.js'
import * as ydb from '../../YdbClient/YdbClient.js'
import DomBinding from '../../src/Bindings/DomBinding/DomBinding.js'

const uuidv4 = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
})

createYdbClient('ws://localhost:8899/ws').then(ydbclient => {
  const y = ydbclient.getY('notelist')
  let ynotelist = y.define('notelist', Y.Array)
  const domNoteList = document.querySelector('.notelist')

  // utils
  const addEventListener = (element, eventname, f) => element.addEventListener(eventname, f)

  // create note button
  const createNoteButton = event => {
    ynotelist.insert(0, [{
      guid: uuidv4(),
      title: 'Note #' + ynotelist.length
    }])
  }
  addEventListener(document.querySelector('#createNoteButton'), 'click', createNoteButton)
  window.createNote = createNoteButton
  window.createNotes = n => {
    y.transact(() => {
      for (let i = 0; i < n; i++) {
        createNoteButton()
      }
    })
  }

  // clear note list function
  window.clearNotes = () => ynotelist.delete(0, ynotelist.length)

  // update editor and editor title
  let domBinding = null
  const updateEditor = () => {
    domNoteList.querySelectorAll('a').forEach(a => a.classList.remove('selected'))
    const domNote = document.querySelector('.notelist').querySelector(`[href="${location.hash}"]`)
    if (domNote !== null) {
      domNote.classList.add('selected')
      const note = ynotelist.toArray().find(note => note.guid === location.hash.slice(1))
      if (note !== undefined) {
        const ydoc = ydbclient.getY(note.guid)
        const ycontent = ydoc.define('content', Y.XmlFragment)
        if (domBinding !== null) {
          domBinding.destroy()
        }
        domBinding = new DomBinding(ycontent, document.querySelector('#editor'))
        document.querySelector('#headline').innerText = note.title
        document.querySelector('#editor').focus()
      }
    }
  }

  // listen to url-hash changes
  addEventListener(window, 'hashchange', updateEditor)
  updateEditor()

  // render note list
  const renderNoteList = addedElements => {
    const fragment = document.createDocumentFragment()
    addedElements.forEach(note => {
      const a = document.createElement('a')
      a.setAttribute('href', '#' + note.guid)
      a.innerText = note.title
      fragment.insertBefore(a, null)
    })
    domNoteList.insertBefore(fragment, domNoteList.firstChild)
  }
  renderNoteList(ynotelist.toArray())
  ydb.subscribeRooms(ydbclient, ynotelist.map(note => note.guid))
  ynotelist.observe(event => {
    const addedNotes = []
    event.addedElements.forEach(itemJson => itemJson._content.forEach(json => addedNotes.push(json)))
    // const arr = ynotelist.toArray().filter(note => event.addedElements.has(note))
    renderNoteList(addedNotes.reverse())
    if (domBinding === null) {
      updateEditor()
    }
  })
})
