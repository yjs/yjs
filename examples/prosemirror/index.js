/* eslint-env browser */
import * as Y from '../../src/index.js'
import ProsemirrorBinding from '../../bindings/ProsemirrorBinding/ProsemirrorBinding.js'
import WebsocketProvider from '../../provider/websocket/WebSocketProvider.js'

import {EditorState} from 'prosemirror-state'
import {EditorView} from 'prosemirror-view'
import {Schema, DOMParser, Mark, Fragment, Node, Slice} from 'prosemirror-model'
import {schema} from 'prosemirror-schema-basic'
import {exampleSetup} from 'prosemirror-example-setup'
import {Plugin} from 'prosemirror-state'
import {Decoration, DecorationSet} from 'prosemirror-view'

let placeholderPlugin = new Plugin({
  state: {
    init() { return DecorationSet.empty },
    apply(tr, set) {
      // Adjust decoration positions to changes made by the transaction
      set = set.map(tr.mapping, tr.doc)
      // See if the transaction adds or removes any placeholders
      let action = tr.getMeta(this)
      if (action && action.add) {
        let widget = document.createElement("placeholder")
        let deco = Decoration.widget(action.add.pos, widget, {id: action.add.id})
        set = set.add(tr.doc, [deco])
      } else if (action && action.remove) {
        set = set.remove(set.find(null, null,
                                  spec => spec.id == action.remove.id))
      }
      return set
    }
  },
  props: {
    decorations(state) { return this.getState(state) }
  }
})

function findPlaceholder(state, id) {
  let decos = placeholderPlugin.getState(state)
  let found = decos.find(null, null, spec => spec.id == id)
  return found.length ? found[0].from : null
}

document.querySelector("#image-upload").addEventListener("change", e => {
  if (view.state.selection.$from.parent.inlineContent && e.target.files.length)
    startImageUpload(view, e.target.files[0])
  view.focus()
})

function startImageUpload(view, file) {
  // A fresh object to act as the ID for this upload
  let id = {}

  // Replace the selection with a placeholder
  let tr = view.state.tr
  if (!tr.selection.empty) tr.deleteSelection()
  tr.setMeta(placeholderPlugin, {add: {id, pos: tr.selection.from}})
  view.dispatch(tr)

  uploadFile(file).then(url => {
    let pos = findPlaceholder(view.state, id)
    // If the content around the placeholder has been deleted, drop
    // the image
    if (pos == null) return
    // Otherwise, insert it at the placeholder's position, and remove
    // the placeholder
    view.dispatch(view.state.tr
                  .replaceWith(pos, pos, schema.nodes.image.create({src: url}))
                  .setMeta(placeholderPlugin, {remove: {id}}))
  }, () => {
    // On failure, just clean up the placeholder
    view.dispatch(tr.setMeta(placeholderPlugin, {remove: {id}}))
  })
}

// This is just a dummy that loads the file and creates a data URL.
// You could swap it out with a function that does an actual upload
// and returns a regular URL for the uploaded file.
function uploadFile (file) {
  let reader = new FileReader()
  return new Promise((accept, fail) => {
    reader.onload = () => accept(reader.result)
    reader.onerror = () => fail(reader.error)
    // Some extra delay to make the asynchronicity visible
    setTimeout(() => reader.readAsDataURL(file), 1500)
  })
}

const view = new EditorView(document.querySelector('#editor'), {
  state: EditorState.create({
    doc: DOMParser.fromSchema(schema).parse(document.querySelector('#content')),
    plugins: exampleSetup({schema}).concat(placeholderPlugin)
  })
})

const provider = new WebsocketProvider('ws://localhost:1234/')
const ydocument = provider.get('prosemirror')
/**
 * @type {any}
 */
const type = ydocument.define('prosemirror', Y.XmlFragment)
const prosemirrorBinding = new ProsemirrorBinding(type, view)

window.view = view
window.EditorState = EditorState
window.EditorView = EditorView
window.Mark = Mark
window.Fragment = Fragment
window.Node = Node
window.Schema = Schema
window.Slice = Slice
window.prosemirrorBinding = prosemirrorBinding
