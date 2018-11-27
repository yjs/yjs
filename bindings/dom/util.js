/**
 * @module bindings/dom
 */

import { domToType } from './domToType.js'
import { DomBinding } from './DomBinding.js' // eslint-disable-line

/**
 * Iterates items until an undeleted item is found.
 *
 * @private
 */
export const iterateUntilUndeleted = item => {
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
 * @function
 * @param {DomBinding} domBinding The binding object
 * @param {Element} dom The dom that is to be associated with type
 * @param {YXmlElement|YXmlHook} type The type that is to be associated with dom
 *
 */
export const removeAssociation = (domBinding, dom, type) => {
  domBinding.domToType.delete(dom)
  domBinding.typeToDom.delete(type)
}

/**
 * Creates an association (the information that a DOM element belongs to a
 * type).
 *
 * @private
 * @function
 * @param {DomBinding} domBinding The binding object
 * @param {DocumentFragment|Element|Text} dom The dom that is to be associated with type
 * @param {YXmlFragment|YXmlElement|YXmlHook|YXmlText} type The type that is to be associated with dom
 *
 */
export const createAssociation = (domBinding, dom, type) => {
  if (domBinding !== undefined) {
    domBinding.domToType.set(dom, type)
    domBinding.typeToDom.set(type, dom)
  }
}

/**
 * If oldDom is associated with a type, associate newDom with the type and
 * forget about oldDom. If oldDom is not associated with any type, nothing happens.
 *
 * @private
 * @function
 * @param {DomBinding} domBinding The binding object
 * @param {Element} oldDom The existing dom
 * @param {Element} newDom The new dom object
 */
export const switchAssociation = (domBinding, oldDom, newDom) => {
  if (domBinding !== undefined) {
    const type = domBinding.domToType.get(oldDom)
    if (type !== undefined) {
      removeAssociation(domBinding, oldDom, type)
      createAssociation(domBinding, newDom, type)
    }
  }
}

/**
 * Insert Dom Elements after one of the children of this YXmlFragment.
 * The Dom elements will be bound to a new YXmlElement and inserted at the
 * specified position.
 *
 * @private
 * @function
 * @param {YXmlElement} type The type in which to insert DOM elements.
 * @param {YXmlElement|null} prev The reference node. New YxmlElements are
 *                           inserted after this node. Set null to insert at
 *                           the beginning.
 * @param {Array<Element>} doms The Dom elements to insert.
 * @param {?Document} _document Optional. Provide the global document object.
 * @param {DomBinding} binding The dom binding
 * @return {Array<YXmlElement>} The YxmlElements that are inserted.
 */
export const insertDomElementsAfter = (type, prev, doms, _document, binding) => {
  const types = domsToTypes(doms, _document, binding.opts.hooks, binding.filter, binding)
  return type.insertAfter(prev, types)
}

export const domsToTypes = (doms, _document, hooks, filter, binding) => {
  const types = []
  for (let dom of doms) {
    const t = domToType(dom, _document, hooks, filter, binding)
    if (t !== false) {
      types.push(t)
    }
  }
  return types
}

/**
 * @private
 * @function
 */
export const insertNodeHelper = (yxml, prevExpectedNode, child, _document, binding) => {
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
 * @private
 * @function
 * @param {Element} parent The parent of `elem` and `currentChild`.
 * @param {Node} currentChild Start removing elements with `currentChild`. If
 *                               `currentChild` is `elem` it won't be removed.
 * @param {Element|null} elem The elemnt to look for.
 */
export const removeDomChildrenUntilElementFound = (parent, currentChild, elem) => {
  while (currentChild !== elem) {
    const del = currentChild
    currentChild = currentChild.nextSibling
    parent.removeChild(del)
  }
}
