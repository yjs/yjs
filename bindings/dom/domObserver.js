/**
 * @module bindings/dom
 */

import { YXmlHook } from '../../types/YXmlHook.js'
import {
  iterateUntilUndeleted,
  removeAssociation,
  insertNodeHelper } from './util.js'
import { simpleDiff } from '../../lib/diff.js'
import { YXmlFragment } from '../../types/YXmlElement.js'

/**
 * 1. Check if any of the nodes was deleted
 * 2. Iterate over the children.
 *    2.1 If a node exists that is not yet bound to a type, insert a new node
 *    2.2 If _contents.length < dom.childNodes.length, fill the
 *        rest of _content with childNodes
 *    2.3 If a node was moved, delete it and
 *       recreate a new yxml element that is bound to that node.
 *       You can detect that a node was moved because expectedId
 *       !== actualId in the list
 *
 * @function
 * @private
 */
const applyChangesFromDom = (binding, dom, yxml, _document) => {
  if (yxml == null || yxml === false || yxml.constructor === YXmlHook) {
    return
  }
  const y = yxml._y
  const knownChildren = new Set()
  for (let i = dom.childNodes.length - 1; i >= 0; i--) {
    const type = binding.domToType.get(dom.childNodes[i])
    if (type !== undefined && type !== false) {
      knownChildren.add(type)
    }
  }
  // 1. Check if any of the nodes was deleted
  yxml.forEach(childType => {
    if (knownChildren.has(childType) === false) {
      childType._delete(y)
      removeAssociation(binding, binding.typeToDom.get(childType), childType)
    }
  })
  // 2. iterate
  const childNodes = dom.childNodes
  const len = childNodes.length
  let prevExpectedType = null
  let expectedType = iterateUntilUndeleted(yxml._start)
  for (let domCnt = 0; domCnt < len; domCnt++) {
    const childNode = childNodes[domCnt]
    const childType = binding.domToType.get(childNode)
    if (childType !== undefined) {
      if (childType === false) {
        // should be ignored or is going to be deleted
        continue
      }
      if (expectedType !== null) {
        if (expectedType !== childType) {
          // 2.3 Not expected node
          if (childType._parent !== yxml) {
            // child was moved from another parent
            // childType is going to be deleted by its previous parent
            removeAssociation(binding, childNode, childType)
          } else {
            // child was moved to a different position.
            removeAssociation(binding, childNode, childType)
            childType._delete(y)
          }
          prevExpectedType = insertNodeHelper(yxml, prevExpectedType, childNode, _document, binding)
        } else {
          // Found expected node. Continue.
          prevExpectedType = expectedType
          expectedType = iterateUntilUndeleted(expectedType._right)
        }
      } else {
        // 2.2 Fill _content with child nodes
        prevExpectedType = insertNodeHelper(yxml, prevExpectedType, childNode, _document, binding)
      }
    } else {
      // 2.1 A new node was found
      prevExpectedType = insertNodeHelper(yxml, prevExpectedType, childNode, _document, binding)
    }
  }
}

/**
 * @private
 * @function
 */
export function domObserver (mutations, _document) {
  this._mutualExclude(() => {
    this.type._y.transact(() => {
      let diffChildren = new Set()
      mutations.forEach(mutation => {
        const dom = mutation.target
        const yxml = this.domToType.get(dom)
        if (yxml === undefined) { // In case yxml is undefined, we double check if we forgot to bind the dom
          let parent = dom
          let yParent
          do {
            parent = parent.parentElement
            yParent = this.domToType.get(parent)
          } while (yParent === undefined && parent !== null)
          if (yParent !== false && yParent !== undefined && yParent.constructor !== YXmlHook) {
            diffChildren.add(parent)
          }
          return
        } else if (yxml === false || yxml.constructor === YXmlHook) {
          // dom element is filtered / a dom hook
          return
        }
        switch (mutation.type) {
          case 'characterData':
            var change = simpleDiff(yxml.toString(), dom.nodeValue)
            yxml.delete(change.pos, change.remove)
            yxml.insert(change.pos, change.insert)
            break
          case 'attributes':
            if (yxml.constructor === YXmlFragment) {
              break
            }
            let name = mutation.attributeName
            let val = dom.getAttribute(name)
            // check if filter accepts attribute
            let attributes = new Map()
            attributes.set(name, val)
            if (yxml.constructor !== YXmlFragment && this.filter(dom.nodeName, attributes).size > 0) {
              if (yxml.getAttribute(name) !== val) {
                if (val == null) {
                  yxml.removeAttribute(name)
                } else {
                  yxml.setAttribute(name, val)
                }
              }
            }
            break
          case 'childList':
            diffChildren.add(mutation.target)
            break
        }
      })
      for (let dom of diffChildren) {
        const yxml = this.domToType.get(dom)
        applyChangesFromDom(this, dom, yxml, _document)
      }
    })
  })
}
