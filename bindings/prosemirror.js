/**
 * @module bindings/prosemirror
 */

import { YText } from '../types/YText.js' // eslint-disable-line
import { YXmlElement, YXmlFragment } from '../types/YXmlElement.js' // eslint-disable-line
import { createMutex } from '../lib/mutex.js'
import * as PModel from 'prosemirror-model'
import { EditorView,  Decoration, DecorationSet } from 'prosemirror-view' // eslint-disable-line
import { Plugin, PluginKey, EditorState, TextSelection } from 'prosemirror-state' // eslint-disable-line
import * as math from '../lib/math.js'
import * as object from '../lib/object.js'
import * as YPos from '../utils/relativePosition.js'

/**
 * @typedef {Map<YText | YXmlElement | YXmlFragment, PModel.Node>} ProsemirrorMapping
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
  let changedInitialContent = false
  const plugin = new Plugin({
    key: prosemirrorPluginKey,
    state: {
      init: (initargs, state) => {
        return pluginState
      },
      apply: (tr, pluginState) => {
        // update Yjs state when apply is called. We need to do this here to compute the correct cursor decorations with the cursor plugin
        if (pluginState.binding !== null && (changedInitialContent || tr.doc.content.size > 4)) {
          changedInitialContent = true
          pluginState.binding._prosemirrorChanged(tr.doc)
        }
        return pluginState
      }
    },
    view: view => {
      const binding = new ProsemirrorBinding(yXmlFragment, view)
      pluginState.binding = binding
      return {
        update: () => {
          if (changedInitialContent || view.state.doc.content.size > 4) {
            changedInitialContent = true
            binding._prosemirrorChanged(view.state.doc)
          }
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
 * The unique prosemirror plugin key for cursorPlugin.type
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
      const ystate = prosemirrorPluginKey.getState(state)
      const y = ystate.y
      const awareness = y.getAwarenessInfo()
      const decorations = []
      awareness.forEach((aw, userID) => {
        if (aw.cursor != null) {
          let user = aw.user || {}
          if (user.color == null) {
            user.color = '#ffa500'
          }
          if (user.name == null) {
            user.name = `User: ${userID}`
          }
          let anchor = relativePositionToAbsolutePosition(ystate.type, aw.cursor.anchor || null, ystate.binding.mapping)
          let head = relativePositionToAbsolutePosition(ystate.type, aw.cursor.head || null, ystate.binding.mapping)
          if (anchor !== null && head !== null) {
            let maxsize = math.max(state.doc.content.size - 1, 0)
            anchor = math.min(anchor, maxsize)
            head = math.min(head, maxsize)
            decorations.push(Decoration.widget(head, () => {
              const cursor = document.createElement('span')
              cursor.classList.add('ProseMirror-yjs-cursor')
              cursor.setAttribute('style', `border-color: ${user.color}`)
              const userDiv = document.createElement('div')
              userDiv.setAttribute('style', `background-color: ${user.color}`)
              userDiv.insertBefore(document.createTextNode(user.name), null)
              cursor.insertBefore(userDiv, null)
              return cursor
            }, { key: userID + '' }))
            const from = math.min(anchor, head)
            const to = math.max(anchor, head)
            decorations.push(Decoration.inline(from, to, { style: `background-color: ${user.color}70` }))
          }
        }
      })
      return DecorationSet.create(state.doc, decorations)
    }
  },
  view: view => {
    const ystate = prosemirrorPluginKey.getState(view.state)
    const y = ystate.y
    const awarenessListener = () => {
      view.updateState(view.state)
    }
    const updateCursorInfo = () => {
      const current = y.getLocalAwarenessInfo()
      if (view.hasFocus()) {
        const anchor = absolutePositionToRelativePosition(view.state.selection.anchor, ystate.type, ystate.binding.mapping)
        const head = absolutePositionToRelativePosition(view.state.selection.head, ystate.type, ystate.binding.mapping)
        if (current.cursor == null || !YPos.equal(current.cursor.anchor, anchor) || !YPos.equal(current.cursor.head, head)) {
          y.setAwarenessField('cursor', {
            anchor, head
          })
        }
      } else if (current.cursor !== null) {
        y.setAwarenessField('cursor', null)
      }
    }
    y.on('awareness', awarenessListener)
    view.dom.addEventListener('focusin', updateCursorInfo)
    view.dom.addEventListener('focusout', updateCursorInfo)
    return {
      update: updateCursorInfo,
      destroy: () => {
        const y = prosemirrorPluginKey.getState(view.state).y
        y.setAwarenessField('cursor', null)
        y.off('awareness', awarenessListener)
      }
    }
  }
})

/**
 * Transforms a Prosemirror based absolute position to a Yjs based relative position.
 *
 * @param {number} pos
 * @param {YXmlFragment} type
 * @param {ProsemirrorMapping} mapping
 * @return {any} relative position
 */
export const absolutePositionToRelativePosition = (pos, type, mapping) => {
  if (pos === 0) {
    return YPos.getRelativePosition(type, 0)
  }
  let n = type._first
  if (n !== null) {
    while (type !== n) {
      const pNodeSize = (mapping.get(n) || { nodeSize: 0 }).nodeSize
      if (n.constructor === YText) {
        if (n.length >= pos) {
          return YPos.getRelativePosition(n, pos)
        } else {
          pos -= n.length
        }
        if (n._next !== null) {
          n = n._next
        } else {
          do {
            n = n._parent
            pos--
          } while (n._next === null && n !== type)
          if (n !== type) {
            n = n._next
          }
        }
      } else if (n._first !== null && pos < pNodeSize) {
        n = n._first
        pos--
      } else {
        if (pos === 1 && n.length === 0 && pNodeSize > 1) {
          // edge case, should end in this paragraph
          return ['endof', n._id.user, n._id.clock, null, null]
        }
        pos -= pNodeSize
        if (n._next !== null) {
          n = n._next
        } else {
          if (pos === 0) {
            n = n._parent
            return ['endof', n._id.user, n._id.clock || null, n._id.name || null, n._id.type || null]
          }
          do {
            n = n._parent
            pos--
          } while (n._next === null && n !== type)
          if (n !== type) {
            n = n._next
          }
        }
      }
      if (pos === 0 && n.constructor !== YText && n !== type) { // TODO: set to <= 0
        return [n._id.user, n._id.clock]
      }
    }
  }
  return YPos.getRelativePosition(type, type.length)
}

/**
 * @param {YXmlFragment} yDoc Top level type that is bound to pView
 * @param {any} relPos Encoded Yjs based relative position
 * @param {ProsemirrorMapping} mapping
 */
export const relativePositionToAbsolutePosition = (yDoc, relPos, mapping) => {
  const decodedPos = YPos.fromRelativePosition(yDoc._y, relPos)
  if (decodedPos === null) {
    return null
  }
  let type = decodedPos.type
  let pos = 0
  if (type.constructor === YText) {
    pos = decodedPos.offset
  } else if (!type._deleted) {
    let n = type._first
    let i = 0
    while (i < type.length && i < decodedPos.offset && n !== null) {
      i++
      pos += mapping.get(n).nodeSize
      n = n._next
    }
    pos += 1 // increase because we go out of n
  }
  while (type !== yDoc) {
    const parent = type._parent
    if (!parent._deleted) {
      pos += 1 // the start tag
      let n = parent._first
      // now iterate until we found type
      while (n !== null) {
        if (n === type) {
          break
        }
        pos += mapping.get(n).nodeSize
        n = n._next
      }
    }
    type = parent
  }
  return pos - 1 // we don't count the most outer tag, because it is a fragment
}

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
    this.mapping = new Map()
    this._observeFunction = this._typeChanged.bind(this)
    this.y = yXmlFragment._y
    /**
     * current selection as relative positions in the Yjs model
     */
    this._relSelection = null
    this.y.on('beforeTransaction', e => {
      this._relSelection = {
        anchor: absolutePositionToRelativePosition(this.prosemirrorView.state.selection.anchor, yXmlFragment, this.mapping),
        head: absolutePositionToRelativePosition(this.prosemirrorView.state.selection.head, yXmlFragment, this.mapping)
      }
    })
    yXmlFragment.observeDeep(this._observeFunction)
  }
  _typeChanged (events, transaction) {
    if (events.length === 0) {
      return
    }
    console.info('new types:', transaction.newTypes.size, 'deleted types:', transaction.deletedStructs.size, transaction.newTypes, transaction.deletedStructs)
    this.mux(() => {
      const delStruct = (_, struct) => this.mapping.delete(struct)
      transaction.deletedStructs.forEach(struct => this.mapping.delete(struct))
      transaction.changedTypes.forEach(delStruct)
      transaction.changedParentTypes.forEach(delStruct)
      const fragmentContent = this.type.toArray().map(t => createNodeIfNotExists(t, this.prosemirrorView.state.schema, this.mapping)).filter(n => n !== null)
      const tr = this.prosemirrorView.state.tr.replace(0, this.prosemirrorView.state.doc.content.size, new PModel.Slice(new PModel.Fragment(fragmentContent), 0, 0))
      const relSel = this._relSelection
      if (relSel !== null && relSel.anchor !== null && relSel.head !== null) {
        const anchor = relativePositionToAbsolutePosition(this.type, relSel.anchor, this.mapping)
        const head = relativePositionToAbsolutePosition(this.type, relSel.head, this.mapping)
        if (anchor !== null && head !== null) {
          tr.setSelection(TextSelection.create(tr.doc, anchor, head))
        }
      }
      this.prosemirrorView.updateState(this.prosemirrorView.state.apply(tr))
    })
  }
  _prosemirrorChanged (doc) {
    this.mux(() => {
      updateYFragment(this.type, doc.content, this.mapping)
    })
  }
  destroy () {
    this.type.unobserveDeep(this._observeFunction)
  }
}

/**
 * @privateMapping
 * @param {YXmlElement} el
 * @param {PModel.Schema} schema
 * @param {ProsemirrorMapping} mapping
 * @return {PModel.Node}
 */
export const createNodeIfNotExists = (el, schema, mapping) => {
  const node = mapping.get(el)
  if (node === undefined) {
    return createNodeFromYElement(el, schema, mapping)
  }
  return node
}

/**
 * @private
 * @param {YXmlElement} el
 * @param {PModel.Schema} schema
 * @param {ProsemirrorMapping} mapping
 * @return {PModel.Node | null} Returns node if node could be created. Otherwise it deletes the yjs type and returns null
 */
export const createNodeFromYElement = (el, schema, mapping) => {
  const children = []
  el.toArray().forEach(type => {
    if (type.constructor === YXmlElement) {
      const n = createNodeIfNotExists(type, schema, mapping)
      if (n !== null) {
        children.push(n)
      }
    } else {
      const ns = createTextNodesFromYText(type, schema, mapping)
      if (ns !== null) {
        ns.forEach(textchild => {
          if (textchild !== null) {
            children.push(textchild)
          }
        })
      }
    }
  })
  let node
  try {
    node = schema.node(el.nodeName.toLowerCase(), el.getAttributes(), children)
  } catch (e) {
    // an error occured while creating the node. This is probably a result because of a concurrent action.
    // delete the node and do not push to children
    el._y.transact(() => {
      el._delete(el._y, true)
    })
    return null
  }
  mapping.set(el, node)
  return node
}

/**
 * @private
 * @param {YText} text
 * @param {PModel.Schema} schema
 * @param {ProsemirrorMapping} mapping
 * @return {Array<PModel.Node>}
 */
export const createTextNodesFromYText = (text, schema, mapping) => {
  const nodes = []
  const deltas = text.toDelta()
  try {
    for (let i = 0; i < deltas.length; i++) {
      const delta = deltas[i]
      const marks = []
      for (let markName in delta.attributes) {
        marks.push(schema.mark(markName, delta.attributes[markName]))
      }
      nodes.push(schema.text(delta.insert, marks))
    }
    if (nodes.length > 0) {
      mapping.set(text, nodes[0]) // only map to first child, all following children are also considered bound to this type
    }
  } catch (e) {
    text._y.transact(() => {
      text._delete(text._y, true)
    })
    return null
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
      const val = node.attrs[key]
      if (val !== null) {
        type.setAttribute(key, val)
      }
    }
    const ins = []
    for (let i = 0; i < node.childCount; i++) {
      ins.push(createTypeFromNode(node.child(i), mapping))
    }
    type.insert(0, ins)
  }
  mapping.set(type, node)
  return type
}

const equalAttrs = (pattrs, yattrs) => {
  const keys = Object.keys(pattrs).filter(key => pattrs[key] === null)
  let eq = keys.length === Object.keys(yattrs).filter(key => yattrs[key] === null).length
  for (let i = 0; i < keys.length && eq; i++) {
    const key = keys[i]
    eq = pattrs[key] === yattrs[key]
  }
  return eq
}

const equalYTextPText = (ytext, ptext) => {
  const d = ytext.toDelta()[0]
  return d.insert === ptext.text && object.keys(d.attributes || {}).length === ptext.marks.length && ptext.marks.every(mark => equalAttrs(d.attributes[mark.type.name], mark.attrs))
}

const equalYTypePNode = (ytype, pnode) =>
  ytype.constructor === YText
    ? equalYTextPText(ytype, pnode)
    : (matchNodeName(ytype, pnode) && ytype.length === pnode.childCount && equalAttrs(ytype.getAttributes(), pnode.attrs) && ytype.toArray().every((ychild, i) => equalYTypePNode(ychild, pnode.child(i))))

const computeChildEqualityFactor = (ytype, pnode, mapping) => {
  const yChildren = ytype.toArray()
  const pChildCnt = pnode.childCount
  const yChildCnt = yChildren.length
  const minCnt = math.min(yChildCnt, pChildCnt)
  let left = 0
  let right = 0
  let foundMappedChild = false
  for (; left < minCnt; left++) {
    const leftY = yChildren[left]
    const leftP = pnode.child(left)
    if (mapping.get(leftY) === leftP) {
      foundMappedChild = true// definite (good) match!
    } else if (!equalYTypePNode(leftY, leftP)) {
      break
    }
  }
  for (; left + right < minCnt; right++) {
    const rightY = yChildren[yChildCnt - right - 1]
    const rightP = pnode.child(pChildCnt - right - 1)
    if (mapping.get(rightY) !== rightP) {
      foundMappedChild = true
    } else if (!equalYTypePNode(rightP, rightP)) {
      break
    }
  }
  return {
    equalityFactor: left + right,
    foundMappedChild
  }
}

/**
 * @private
 * @param {YXmlFragment} yDomFragment
 * @param {PModel.Node} pContent
 * @param {ProsemirrorMapping} mapping
 */
const updateYFragment = (yDomFragment, pContent, mapping) => {
  if (yDomFragment instanceof YXmlElement && yDomFragment.nodeName.toLowerCase() !== pContent.type.name) {
    throw new Error('node name mismatch!')
  }
  mapping.set(yDomFragment, pContent)
  // update attributes
  if (yDomFragment instanceof YXmlElement) {
    const yDomAttrs = yDomFragment.getAttributes()
    const pAttrs = pContent.attrs
    for (let key in pAttrs) {
      if (pAttrs[key] !== null) {
        if (yDomAttrs[key] !== pAttrs[key]) {
          yDomFragment.setAttribute(key, pAttrs[key])
        }
      } else {
        yDomFragment.removeAttribute(key)
      }
    }
    // remove all keys that are no longer in pAttrs
    for (let key in yDomAttrs) {
      if (pAttrs[key] === undefined) {
        yDomFragment.removeAttribute(key)
      }
    }
  }
  // update children
  const pChildCnt = pContent.childCount
  const yChildren = yDomFragment.toArray()
  const yChildCnt = yChildren.length
  const minCnt = math.min(pChildCnt, yChildCnt)
  let left = 0
  let right = 0
  // find number of matching elements from left
  for (;left < minCnt; left++) {
    const leftY = yChildren[left]
    const leftP = pContent.child(left)
    if (mapping.get(leftY) !== leftP) {
      if (equalYTypePNode(leftY, leftP)) {
        // update mapping
        mapping.set(leftY, leftP)
      } else {
        break
      }
    }
  }
  // find number of matching elements from right
  for (;right + left < minCnt; right++) {
    const rightY = yChildren[yChildCnt - right - 1]
    const rightP = pContent.child(pChildCnt - right - 1)
    if (mapping.get(rightY) !== rightP) {
      if (equalYTypePNode(rightY, rightP)) {
        // update mapping
        mapping.set(rightY, rightP)
      } else {
        break
      }
    }
  }
  yDomFragment._y.transact(() => {
    // try to compare and update
    while (yChildCnt - left - right > 0 && pChildCnt - left - right > 0) {
      const leftY = yChildren[left]
      const leftP = pContent.child(left)
      const rightY = yChildren[yChildCnt - right - 1]
      const rightP = pContent.child(pChildCnt - right - 1)
      if (leftY.constructor === YText && leftP.isText) {
        if (!equalYTextPText(leftY, leftP)) {
          yDomFragment.delete(left, 1)
          yDomFragment.insert(left, [createTypeFromNode(leftP, mapping)])
        }
        left += 1
      } else {
        let updateLeft = matchNodeName(leftY, leftP)
        let updateRight = matchNodeName(rightY, rightP)
        if (updateLeft && updateRight) {
          // decide which which element to update
          const equalityLeft = computeChildEqualityFactor(leftY, leftP, mapping)
          const equalityRight = computeChildEqualityFactor(rightY, rightP, mapping)
          if (equalityLeft.foundMappedChild && !equalityRight.foundMappedChild) {
            updateRight = false
          } else if (!equalityLeft.foundMappedChild && equalityRight.foundMappedChild) {
            updateLeft = false
          } else if (equalityLeft.equalityFactor < equalityRight.equalityFactor) {
            updateLeft = false
          } else {
            updateRight = false
          }
        }
        if (updateLeft) {
          updateYFragment(leftY, leftP, mapping)
          left += 1
        } else if (updateRight) {
          updateYFragment(rightY, rightP, mapping)
          right += 1
        } else {
          yDomFragment.delete(left, 1)
          yDomFragment.insert(left, [createTypeFromNode(leftP, mapping)])
          left += 1
        }
      }
    }
    const yDelLen = yChildCnt - left - right
    if (yDelLen > 0) {
      yDomFragment.delete(left, yDelLen)
    }
    if (left + right < pChildCnt) {
      const ins = []
      for (let i = left; i < pChildCnt - right; i++) {
        ins.push(createTypeFromNode(pContent.child(i), mapping))
      }
      yDomFragment.insert(left, ins)
    }
  })
}

/**
 * @function
 * @param {YXmlElement} yElement
 * @param {any} pNode Prosemirror Node
 */
const matchNodeName = (yElement, pNode) => yElement.nodeName === pNode.type.name.toUpperCase()
