/**
 * @module bindings/prosemirror
 */

import { BindMapping } from '../utils/BindMapping.mjs'
import { YText } from '../types/YText.mjs' // eslint-disable-line
import { YXmlElement, YXmlFragment } from '../types/YXmlElement.mjs' // eslint-disable-line
import { createMutex } from '../lib/mutex.mjs'
import * as PModel from 'prosemirror-model'
import { EditorView,  Decoration, DecorationSet } from 'prosemirror-view' // eslint-disable-line
import { Plugin, PluginKey, EditorState } from 'prosemirror-state' // eslint-disable-line

/**
 * @typedef {BindMapping<YText | YXmlElement, PModel.Node>} ProsemirrorMapping
 */

/**
 * The unique prosemirror plugin key for prosemirrorPlugin.
 *
 * @public
 */
export const prosemirrorPluginKey = new PluginKey('yjs')

/**
 * This plugin listens to changes in prosemirror view and keeps yXmlState and view in sync.
 *
 * This plugin also keeps references to the type and the shared document so other plugins can access it.
 * @param {YXmlFragment} yXmlFragment
 * @return {Plugin} Returns a prosemirror plugin that binds to this type
 */
export const prosemirrorPlugin = yXmlFragment => {
  const pluginState = {
    type: yXmlFragment,
    y: yXmlFragment._y,
    binding: null
  }
  const plugin = new Plugin({
    key: prosemirrorPluginKey,
    state: {
      init: (initargs, state) => {
        return pluginState
      },
      apply: (tr, pluginState) => {
        return pluginState
      }
    },
    view: view => {
      const binding = new ProsemirrorBinding(yXmlFragment, view)
      pluginState.binding = binding
      return {
        update: () => {
          binding._prosemirrorChanged()
        },
        destroy: () => {
          binding.destroy()
        }
      }
    }
  })
  return plugin
}

/**
 * The unique prosemirror plugin key for cursorPlugin.
 *
 * @public
 */
export const cursorPluginKey = new PluginKey('yjs-cursor')

/**
 * A prosemirror plugin that listens to awareness information on Yjs.
 * This requires that a `prosemirrorPlugin` is also bound to the prosemirror.
 *
 * @public
 */
export const cursorPlugin = new Plugin({
  key: cursorPluginKey,
  props: {
    decorations: state => {
      const y = prosemirrorPluginKey.getState(state).y
      const awareness = y.getAwarenessInfo()
      const decorations = []
      awareness.forEach((state, userID) => {
        if (state.cursor != null) {
          const username = `User: ${userID}`
          decorations.push(Decoration.widget(state.cursor.from, () => {
            const cursor = document.createElement('span')
            cursor.classList.add('ProseMirror-yjs-cursor')
            const user = document.createElement('div')
            user.insertBefore(document.createTextNode(username), null)
            cursor.insertBefore(user, null)
            return cursor
          }, { key: username }))
          decorations.push(Decoration.inline(state.cursor.from, state.cursor.to, { style: 'background-color: #ffa50070' }))
        }
      })
      return DecorationSet.create(state.doc, decorations)
    }
  },
  view: view => {
    const y = prosemirrorPluginKey.getState(view.state).y
    const awarenessListener = () => {
      view.updateState(view.state)
    }
    y.on('awareness', awarenessListener)
    return {
      update: () => {
        const y = prosemirrorPluginKey.getState(view.state).y
        const from = view.state.selection.from
        const to = view.state.selection.to
        const current = y.getLocalAwarenessInfo()
        if (current.cursor == null || current.cursor.to !== to || current.cursor.from !== from) {
          y.setAwarenessField('cursor', {
            from, to
          })
        }
      },
      destroy: () => {
        const y = prosemirrorPluginKey.getState(view.state).y
        y.setAwarenessField('cursor', null)
        y.off('awareness', awarenessListener)
      }
    }
  }
})

/**
 * Binding for prosemirror.
 *
 * @protected
 */
export class ProsemirrorBinding {
  /**
   * @param {YXmlFragment} yXmlFragment The bind source
   * @param {EditorView} prosemirrorView The target binding
   */
  constructor (yXmlFragment, prosemirrorView) {
    this.type = yXmlFragment
    this.prosemirrorView = prosemirrorView
    this.mux = createMutex()
    /**
     * @type {ProsemirrorMapping}
     */
    this.mapping = new BindMapping()
    this._observeFunction = this._typeChanged.bind(this)
    yXmlFragment.observeDeep(this._observeFunction)
  }
  _typeChanged (events) {
    if (events.length === 0) {
      return
    }
    this.mux(() => {
      events.forEach(event => {
        // recompute node for each parent
        // except main node, compute main node in the end
        let target = event.target
        if (target !== this.type) {
          do {
            if (target.constructor === YXmlElement) {
              createNodeFromYElement(target, this.prosemirrorView.state.schema, this.mapping)
            }
            target = target._parent
          } while (target._parent !== this.type)
        }
      })
      const fragmentContent = this.type.toArray().map(t => createNodeIfNotExists(t, this.prosemirrorView.state.schema, this.mapping))
      const tr = this.prosemirrorView.state.tr.replace(0, this.prosemirrorView.state.doc.content.size, new PModel.Slice(new PModel.Fragment(fragmentContent), 0, 0))
      this.prosemirrorView.updateState(this.prosemirrorView.state.apply(tr))
    })
  }
  _prosemirrorChanged () {
    this.mux(() => {
      updateYFragment(this.type, this.prosemirrorView.state, this.mapping)
    })
  }
  destroy () {
    this.type.unobserveDeep(this._observeFunction)
  }
}

/**
 * @private
 * @param {Y.XmlElement} el
 * @param {PModel.Schema} schema
 * @param {ProsemirrorMapping} mapping
 * @return {PModel.Node}
 */
export const createNodeIfNotExists = (el, schema, mapping) => {
  const node = mapping.getY(el)
  if (node === undefined) {
    return createNodeFromYElement(el, schema, mapping)
  }
  return node
}

/**
 * @private
 * @param {Y.XmlElement} el
 * @param {PModel.Schema} schema
 * @param {ProsemirrorMapping} mapping
 * @return {PModel.Node}
 */
export const createNodeFromYElement = (el, schema, mapping) => {
  const children = []
  el.toArray().forEach(type => {
    if (type.constructor === YXmlElement) {
      children.push(createNodeIfNotExists(type, schema, mapping))
    } else {
      children.concat(createTextNodesFromYText(type, schema, mapping)).forEach(textchild => children.push(textchild))
    }
  })
  const node = schema.node(el.nodeName.toLowerCase(), el.getAttributes(), el.toArray().map(t => createNodeIfNotExists(t, schema, mapping)))
  mapping.bind(el, node)
  return node
}

/**
 * @private
 * @param {Y.Text} text
 * @param {PModel.Schema} schema
 * @param {ProsemirrorMapping} mapping
 * @return {Array<PModel.Node>}
 */
export const createTextNodesFromYText = (text, schema, mapping) => {
  const nodes = []
  const deltas = text.toDelta()
  for (let i = 0; i < deltas.length; i++) {
    const delta = deltas[i]
    const marks = []
    for (let markName in delta.attributes) {
      marks.push(schema.mark(markName, delta.attributes[markName]))
    }
    nodes.push(schema.text(delta.insert, marks))
  }
  if (nodes.length > 0) {
    mapping.bind(text, nodes[0]) // only map to first child, all following children are also considered bound to this type
  }
  return nodes
}

/**
 * @private
 * @param {PModel.Node} node
 * @param {ProsemirrorMapping} mapping
 * @return {YXmlElement | YText}
 */
export const createTypeFromNode = (node, mapping) => {
  let type
  if (node.isText) {
    type = new YText()
    const attrs = {}
    node.marks.forEach(mark => { attrs[mark.type.name] = mark.attrs })
    type.insert(0, node.text, attrs)
  } else {
    type = new YXmlElement(node.type.name)
    for (let key in node.attrs) {
      type.setAttribute(key, node.attrs[key])
    }
    type.insert(0, node.content.content.map(node => createTypeFromNode(node, mapping)))
  }
  mapping.bind(type, node)
  return type
}

/**
 * @private
 * @param {YXmlFragment} yDomFragment
 * @param {EditorState} state
 * @param {BindMapping} mapping
 */
const updateYFragment = (yDomFragment, state, mapping) => {
  const pChildCnt = state.doc.content.childCount
  const yChildren = yDomFragment.toArray()
  const yChildCnt = yChildren.length
  const minCnt = pChildCnt < yChildCnt ? pChildCnt : yChildCnt
  let left = 0
  let right = 0
  // find number of matching elements from left
  for (;left < minCnt; left++) {
    if (state.doc.content.child(left) !== mapping.getY(yChildren[left])) {
      break
    }
  }
  // find number of matching elements from right
  for (;right < minCnt; right++) {
    if (state.doc.content.child(pChildCnt - right - 1) !== mapping.getY(yChildren[yChildCnt - right - 1])) {
      break
    }
  }
  if (left + right > pChildCnt) {
    // nothing changed
    return
  }
  yDomFragment._y.transact(() => {
    // now update y to match editor state
    yDomFragment.delete(left, yChildCnt - left - right)
    yDomFragment.insert(left, state.doc.content.content.slice(left, pChildCnt - right).map(node => createTypeFromNode(node, mapping)))
  })
}
