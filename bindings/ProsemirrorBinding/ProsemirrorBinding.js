import BindMapping from '../BindMapping.js'
import * as PModel from 'prosemirror-model'
import * as Y from '../../src/index.js'
import { createMutex } from '../../lib/mutex.js'

/**
 * @typedef {import('prosemirror-view').EditorView} EditorView
 * @typedef {import('prosemirror-state').EditorState} EditorState
 * @typedef {BindMapping<Y.Text | Y.XmlElement, PModel.Node>} ProsemirrorMapping
 */

export default class ProsemirrorBinding {
  /**
   * @param {Y.XmlFragment} yDomFragment The bind source
   * @param {EditorView} prosemirror The target binding
   */
  constructor (yDomFragment, prosemirror) {
    this.type = yDomFragment
    this.prosemirror = prosemirror
    const mux = createMutex()
    this.mux = mux
    /**
     * @type {ProsemirrorMapping}
     */
    const mapping = new BindMapping()
    this.mapping = mapping
    const oldDispatch = prosemirror.props.dispatchTransaction || null
    /**
     * @type {any}
     */
    const updatedProps = {
      dispatchTransaction: function (tr) {
        // TODO: remove
        const newState = prosemirror.state.apply(tr)
        mux(() => {
          updateYFragment(yDomFragment, newState, mapping)
        })
        if (oldDispatch !== null) {
          oldDispatch.call(this, tr)
        } else {
          prosemirror.updateState(newState)
        }
      }
    }
    prosemirror.setProps(updatedProps)
    yDomFragment.observeDeep(events => {
      if (events.length === 0) {
        return
      }
      mux(() => {
        events.forEach(event => {
          // recompute node for each parent
          // except main node, compute main node in the end
          let target = event.target
          if (target !== yDomFragment) {
            do {
              if (target.constructor === Y.XmlElement) {
                createNodeFromYElement(target, prosemirror.state.schema, mapping)
              }
              target = target._parent
            } while (target._parent !== yDomFragment)
          }
        })
        const fragmentContent = yDomFragment.toArray().map(t => createNodeIfNotExists(t, prosemirror.state.schema, mapping))
        const tr = prosemirror.state.tr.replace(0, prosemirror.state.doc.content.size, new PModel.Slice(new PModel.Fragment(fragmentContent), 0, 0))
        const newState = prosemirror.updateState(prosemirror.state.apply(tr))
        console.log('state updated', newState, tr)
      })
    })
  }
}

/**
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
 * @param {Y.XmlElement} el
 * @param {PModel.Schema} schema
 * @param {ProsemirrorMapping} mapping
 * @return {PModel.Node}
 */
export const createNodeFromYElement = (el, schema, mapping) => {
  const children = []
  el.toArray().forEach(type => {
    if (type.constructor === Y.XmlElement) {
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
 * @param {PModel.Node} node
 * @param {ProsemirrorMapping} mapping
 * @return {Y.XmlElement | Y.Text}
 */
export const createTypeFromNode = (node, mapping) => {
  let type
  if (node.isText) {
    type = new Y.Text()
    const attrs = {}
    node.marks.forEach(mark => { attrs[mark.type.name] = mark.attrs })
    type.insert(0, node.text, attrs)
  } else {
    type = new Y.XmlElement(node.type.name)
    for (let key in node.attrs) {
      type.setAttribute(key, node.attrs[key])
    }
    type.insert(0, node.content.content.map(node => createTypeFromNode(node, mapping)))
  }
  mapping.bind(type, node)
  return type
}

/**
 * @param {Y.XmlFragment} yDomFragment
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
  console.log(yDomFragment.toDomString())
}
