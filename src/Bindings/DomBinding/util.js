
import domToType from './domToType.js'

/**
 * Iterates items until an undeleted item is found.
 *
 * @private
 */
export function iterateUntilUndeleted (item) {
  while (item !== null && item._deleted) {
    item = item._right
  }
  return item
}

/**
 * Removes an association (the information that a DOM element belongs to a
 * type).
 *
 * @private
 */
export function removeAssociation (domBinding, dom, type) {
  domBinding.domToType.delete(dom)
  domBinding.typeToDom.delete(type)
}

/**
 * Creates an association (the information that a DOM element belongs to a
 * type).
 *
 * @private
 */
export function createAssociation (domBinding, dom, type) {
  if (domBinding !== undefined) {
    domBinding.domToType.set(dom, type)
    domBinding.typeToDom.set(type, dom)
  }
}

/**
 * Insert Dom Elements after one of the children of this YXmlFragment.
 * The Dom elements will be bound to a new YXmlElement and inserted at the
 * specified position.
 *
 * @param {YXmlElement} type The type in which to insert DOM elements.
 * @param {YXmlElement|null} prev The reference node. New YxmlElements are
 *                           inserted after this node. Set null to insert at
 *                           the beginning.
 * @param {Array<Element>} doms The Dom elements to insert.
 * @param {?Document} _document Optional. Provide the global document object.
 * @param {DomBinding} binding The dom binding
 * @return {Array<YXmlElement>} The YxmlElements that are inserted.
 *
 * @private
 */
export function insertDomElementsAfter (type, prev, doms, _document, binding) {
  return type.insertAfter(prev, doms.map(dom => domToType(dom, _document, binding)))
}

/**
 * @private
 */
export function insertNodeHelper (yxml, prevExpectedNode, child, _document, binding) {
  let insertedNodes = insertDomElementsAfter(yxml, prevExpectedNode, [child], _document, binding)
  if (insertedNodes.length > 0) {
    return insertedNodes[0]
  } else {
    return prevExpectedNode
  }
}

/**
 * Remove children until `elem` is found.
 *
 * @param {Element} parent The parent of `elem` and `currentChild`.
 * @param {Element} currentChild Start removing elements with `currentChild`. If
 *                               `currentChild` is `elem` it won't be removed.
 * @param {Element|null} elem The elemnt to look for.
 *
 * @private
 */
export function removeDomChildrenUntilElementFound (parent, currentChild, elem) {
  while (currentChild !== elem) {
    const del = currentChild
    currentChild = currentChild.nextSibling
    parent.removeChild(del)
  }
}
