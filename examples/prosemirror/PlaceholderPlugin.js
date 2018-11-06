/* eslint-env browser */

import {Plugin} from 'prosemirror-state'
import {Decoration, DecorationSet} from 'prosemirror-view'
import {schema} from 'prosemirror-schema-basic'

const findPlaceholder = (state, id) => {
  let decos = PlaceholderPlugin.getState(state)
  let found = decos.find(null, null, spec => spec.id === id)
  return found.length ? found[0].from : null
}

export const startImageUpload = (view, file) => {
  // A fresh object to act as the ID for this upload
  let id = {}

  // Replace the selection with a placeholder
  let tr = view.state.tr
  if (!tr.selection.empty) tr.deleteSelection()
  tr.setMeta(PlaceholderPlugin, {add: {id, pos: tr.selection.from}})
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
      .setMeta(PlaceholderPlugin, {remove: {id}}))
  }, () => {
    // On failure, just clean up the placeholder
    view.dispatch(tr.setMeta(PlaceholderPlugin, {remove: {id}}))
  })
}

// This is just a dummy that loads the file and creates a data URL.
// You could swap it out with a function that does an actual upload
// and returns a regular URL for the uploaded file.
function uploadFile (file) {
  let reader = new FileReader()
  return new Promise((resolve, reject) => {
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    // Some extra delay to make the asynchronicity visible
    setTimeout(() => reader.readAsDataURL(file), 1500)
  })
}

export const PlaceholderPlugin = new Plugin({
  state: {
    init () { return DecorationSet.empty },
    apply (tr, set) {
      // Adjust decoration positions to changes made by the transaction
      set = set.map(tr.mapping, tr.doc)
      // See if the transaction adds or removes any placeholders
      let action = tr.getMeta(this)
      if (action && action.add) {
        let widget = document.createElement('placeholder')
        let deco = Decoration.widget(action.add.pos, widget, {id: action.add.id})
        set = set.add(tr.doc, [deco])
      } else if (action && action.remove) {
        set = set.remove(set.find(null, null, spec => spec.id === action.remove.id))
      }
      return set
    }
  },
  props: {
    decorations (state) { return this.getState(state) }
  }
})
