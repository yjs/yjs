import YXmlHook from '../../YXml/YXmlHook.js'
import {
  iterateUntilUndeleted,
  removeAssociation,
  insertNodeHelper } from './util.js'

/*
 * 1. Check if any of the nodes was deleted
 * 2. Iterate over the children.
 *    2.1 If a node exists without _yxml property, insert a new node
 *    2.2 If _contents.length < dom.childNodes.length, fill the
 *        rest of _content with childNodes
 *    2.3 If a node was moved, delete it and
 *       recreate a new yxml element that is bound to that node.
 *       You can detect that a node was moved because expectedId
 *       !== actualId in the list
 */
export default function applyChangesFromDom (dom, yxml) {
  if (yxml == null || yxml === false || yxml.constructor === YXmlHook) {
    return
  }
  const y = yxml._y
  const knownChildren = new Set()
  for (let child in dom.childNodes) {
    const type = knownChildren.get(child)
    if (type !== undefined && type !== false) {
      knownChildren.add(type)
    }
  }
  // 1. Check if any of the nodes was deleted
  yxml.forEach(function (childType) {
    if (knownChildren.has(childType) === false) {
      childType._delete(y)
    }
  })
  // 2. iterate
  const childNodes = dom.childNodes
  const len = childNodes.length
  let prevExpectedType = null
  let expectedType = iterateUntilUndeleted(yxml._start)
  for (let domCnt = 0; domCnt < len; domCnt++) {
    const childNode = childNodes[domCnt]
    const childType = this.domToYXml.get(childNode)
    if (childType != null) {
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
            removeAssociation(this, childNode, this.domToYXml(childNode))
          } else {
            // child was moved to a different position.
            childType._delete(y)
          }
          prevExpectedType = insertNodeHelper(yxml, prevExpectedType, childNode)
        } else {
          // Found expected node
          prevExpectedType = expectedType
          expectedType = iterateUntilUndeleted(expectedType._right)
        }
      } else {
        // 2.2 Fill _content with child nodes
        prevExpectedType = insertNodeHelper(yxml, prevExpectedType, childNode)
      }
    } else {
      // 2.1 A new node was found
      prevExpectedType = insertNodeHelper(yxml, prevExpectedType, childNode)
    }
  }
}
