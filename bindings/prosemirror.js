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
import { isVisible } from '../utils/snapshot.js'
import { simpleDiff } from '../lib/diff.js'

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
  let changedInitialContent = false
  const plugin = new Plugin({
    props: {
      editable: (state) => prosemirrorPluginKey.getState(state).snapshot == null
    },
    key: prosemirrorPluginKey,
    state: {
      init: (initargs, state) => {
        return {
          type: yXmlFragment,
          y: yXmlFragment._y,
          binding: null,
          snapshot: null,
          isChangeOrigin: false
        }
      },
      apply: (tr, pluginState) => {
        const change = tr.getMeta(prosemirrorPluginKey)
        if (change !== undefined) {
          pluginState = Object.assign({}, pluginState)
          for (let key in change) {
            pluginState[key] = change[key]
          }
        }
        // always set isChangeOrigin. If undefined, this is not change origin.
        pluginState.isChangeOrigin = change !== undefined && !!change.isChangeOrigin
        if (pluginState.binding !== null) {
          if (change !== undefined && change.snapshot !== undefined) {
            // snapshot changed, rerender next
            setTimeout(() => {
              if (change.restore == null) {
                pluginState.binding._renderSnapshot(change.snapshot, change.prevSnapshot)
              } else {
                pluginState.binding._renderSnapshot(change.snapshot, change.snapshot)
                // reset to current prosemirror state
                delete pluginState.restore
                delete pluginState.snapshot
                delete pluginState.prevSnapshot
                pluginState.binding._prosemirrorChanged(pluginState.binding.prosemirrorView.state.doc)
              }
            }, 0)
          } else if (pluginState.snapshot == null) {
            // only apply if no snapshot active
            // update Yjs state when apply is called. We need to do this here to compute the correct cursor decorations with the cursor plugin
            if (changedInitialContent || tr.doc.content.size > 4) {
              changedInitialContent = true
              pluginState.binding._prosemirrorChanged(tr.doc)
            }
          }
        }
        return pluginState
      }
    },
    view: view => {
      const binding = new ProsemirrorBinding(yXmlFragment, view)
      view.dispatch(view.state.tr.setMeta(prosemirrorPluginKey, { binding }))
      return {
        update: () => {
          const pluginState = plugin.getState(view.state)
          if (pluginState.snapshot == null) {
            if (changedInitialContent || view.state.doc.content.size > 4) {
              changedInitialContent = true
              binding._prosemirrorChanged(view.state.doc)
            }
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
      if (ystate.snapshot != null) {
        // do not render cursors while snapshot is active
        return
      }
      awareness.forEach((aw, userID) => {
        if (userID === y.userID) {
          return
        }
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
      if (view.hasFocus() && ystate.binding !== null) {
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
  _forceRerender () {
    this.mapping = new Map()
    this.mux(() => {
      const fragmentContent = this.type.toArray().map(t => createNodeFromYElement(t, this.prosemirrorView.state.schema, this.mapping)).filter(n => n !== null)
      const tr = this.prosemirrorView.state.tr.replace(0, this.prosemirrorView.state.doc.content.size, new PModel.Slice(new PModel.Fragment(fragmentContent), 0, 0))
      this.prosemirrorView.dispatch(tr)
    })
  }
  /**
   *
   * @param {*} snapshot
   * @param {*} prevSnapshot
   */
  _renderSnapshot (snapshot, prevSnapshot) {
    // clear mapping because we are going to rerender
    this.mapping = new Map()
    this.mux(() => {
      const fragmentContent = this.type.toArray({ sm: snapshot.sm, ds: prevSnapshot.ds}).map(t => createNodeFromYElement(t, this.prosemirrorView.state.schema, new Map(), snapshot, prevSnapshot)).filter(n => n !== null)
      const tr = this.prosemirrorView.state.tr.replace(0, this.prosemirrorView.state.doc.content.size, new PModel.Slice(new PModel.Fragment(fragmentContent), 0, 0))
      this.prosemirrorView.dispatch(tr)
    })
  }
  _typeChanged (events, transaction) {
    if (events.length === 0 || prosemirrorPluginKey.getState(this.prosemirrorView.state).snapshot != null) {
      // drop out if snapshot is active
      return
    }
    console.info('new types:', transaction.newTypes.size, 'deleted types:', transaction.deletedStructs.size, transaction.newTypes, transaction.deletedStructs)
    this.mux(() => {
      const delStruct = (_, struct) => this.mapping.delete(struct)
      transaction.deletedStructs.forEach(struct => this.mapping.delete(struct))
      transaction.changedTypes.forEach(delStruct)
      transaction.changedParentTypes.forEach(delStruct)
      const fragmentContent = this.type.toArray().map(t => createNodeIfNotExists(t, this.prosemirrorView.state.schema, this.mapping)).filter(n => n !== null)
      let tr = this.prosemirrorView.state.tr.replace(0, this.prosemirrorView.state.doc.content.size, new PModel.Slice(new PModel.Fragment(fragmentContent), 0, 0))
      const relSel = this._relSelection
      if (relSel !== null && relSel.anchor !== null && relSel.head !== null) {
        const anchor = relativePositionToAbsolutePosition(this.type, relSel.anchor, this.mapping)
        const head = relativePositionToAbsolutePosition(this.type, relSel.head, this.mapping)
        if (anchor !== null && head !== null) {
          tr = tr.setSelection(TextSelection.create(tr.doc, anchor, head))
        }
      }
      tr = tr.setMeta(prosemirrorPluginKey, { isChangeOrigin: true })
      this.prosemirrorView.dispatch(tr)
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
 * @private
 * @param {YXmlElement} el
 * @param {PModel.Schema} schema
 * @param {ProsemirrorMapping} mapping
 * @param {HistorySnapshot} [snapshot]
 * @param {HistorySnapshot} [prevSnapshot]
 * @return {PModel.Node}
 */
export const createNodeIfNotExists = (el, schema, mapping, snapshot, prevSnapshot) => {
  const node = mapping.get(el)
  if (node === undefined) {
    return createNodeFromYElement(el, schema, mapping, snapshot, prevSnapshot)
  }
  return node
}

/**
 * @private
 * @param {YXmlElement} el
 * @param {PModel.Schema} schema
 * @param {ProsemirrorMapping} mapping
 * @param {import('../protocols/history.js').HistorySnapshot} [snapshot]
 * @param {import('../protocols/history.js').HistorySnapshot} [prevSnapshot]
 * @return {PModel.Node | null} Returns node if node could be created. Otherwise it deletes the yjs type and returns null
 */
export const createNodeFromYElement = (el, schema, mapping, snapshot, prevSnapshot) => {
  let _snapshot = snapshot
  let _prevSnapshot = prevSnapshot
  if (snapshot !== undefined && prevSnapshot !== undefined) {
    if (!isVisible(el, snapshot)) {
      // if this element is already rendered as deleted (ychange), then do not render children as deleted
      _snapshot = {sm: snapshot.sm, ds: prevSnapshot.ds}
      _prevSnapshot = _snapshot
    } else if (!isVisible(el, prevSnapshot)) {
      _prevSnapshot = _snapshot
    }
  }
  const children = []
  const createChildren = type => {
    if (type.constructor === YXmlElement) {
      const n = createNodeIfNotExists(type, schema, mapping, _snapshot, _prevSnapshot)
      if (n !== null) {
        children.push(n)
      }
    } else {
      const ns = createTextNodesFromYText(type, schema, mapping, _snapshot, _prevSnapshot)
      if (ns !== null) {
        ns.forEach(textchild => {
          if (textchild !== null) {
            children.push(textchild)
          }
        })
      }
    }
  }
  if (snapshot === undefined || prevSnapshot === undefined) {
    el.toArray().forEach(createChildren)
  } else {
    el.toArray({sm: snapshot.sm, ds: prevSnapshot.ds}).forEach(createChildren)
  }
  let node
  try {
    const attrs = el.getAttributes(_snapshot)
    if (snapshot !== undefined) {
      if (!isVisible(el, snapshot)) {
        attrs.ychange = { user: el._id.user, state: 'removed' }
      } else if (!isVisible(el, prevSnapshot)) {
        attrs.ychange = { user: el._id.user, state: 'added' }
      }
    }
    node = schema.node(el.nodeName.toLowerCase(), attrs, children)
  } catch (e) {
    // an error occured while creating the node. This is probably a result because of a concurrent action.
    // ignore the node while rendering
    /* do not delete anymore
    el._y.transact(() => {
      el._delete(el._y, true)
    })
    */
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
 * @param {HistorySnapshot} [snapshot]
 * @param {HistorySnapshot} [prevSnapshot]
 * @return {Array<PModel.Node>}
 */
export const createTextNodesFromYText = (text, schema, mapping, snapshot, prevSnapshot) => {
  const nodes = []
  const deltas = text.toDelta(snapshot, prevSnapshot)
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
    /*
    text._y.transact(() => {
      text._delete(text._y, true)
    })
    */
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
    node.marks.forEach(mark => {
      if (mark.type.name !== 'ychange') {
        attrs[mark.type.name] = mark.attrs
      }
    })
    type.insert(0, node.text, attrs)
  } else {
    type = new YXmlElement(node.type.name)
    for (let key in node.attrs) {
      const val = node.attrs[key]
      if (val !== null && key !== 'ychange') {
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
    const l = pattrs[key]
    const r = yattrs[key]
    eq = key === 'ychange' || l === r || (typeof l === 'object' && typeof r === 'object' && equalAttrs(l, r))
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
        if (yDomAttrs[key] !== pAttrs[key] && key !== 'ychange') {
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
          // try to apply diff. Only if attrs don't match, delete insert
          // TODO: use a single ytext to hold all following Prosemirror Text nodes
          const pattrs = {}
          leftP.marks.forEach(mark => {
            if (mark.type.name !== 'ychange') {
              pattrs[mark.type.name] = mark.attrs
            }
          })
          const delta = leftY.toDelta()
          if (delta.length === 1 && delta[0].insert && equalAttrs(pattrs, delta[0].attributes || {})) {
            const diff = simpleDiff(delta[0].insert, leftP.text)
            leftY.delete(diff.pos, diff.remove)
            leftY.insert(diff.pos, diff.insert)
          } else {
            yDomFragment.delete(left, 1)
            yDomFragment.insert(left, [createTypeFromNode(leftP, mapping)])
          }
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
