/**
 * @module bindings/dom
 */

import { Y } from '../../utils/Y.js' // eslint-disable-line
import { YXmlElement, YXmlFragment } from '../../types/YXmlElement.js' // eslint-disable-line
import { isParentOf } from '../../utils/isParentOf.js'
import { DomBinding } from './DomBinding.js' // eslint-disable-line

/**
 * Default filter method (does nothing).
 *
 * @function
 * @param {String} nodeName The nodeName of the element
 * @param {Map} attrs Map of key-value pairs that are attributes of the node.
 * @return {Map | null} The allowed attributes or null, if the element should be
 *                      filtered.
 */
export const defaultFilter = (nodeName, attrs) => {
  // TODO: implement basic filter that filters out dangerous properties!
  return attrs
}

/**
 * @private
 * @function
 * @param {Element} dom
 * @param {Function} filter
 */
export const filterDomAttributes = (dom, filter) => {
  const attrs = new Map()
  for (let i = dom.attributes.length - 1; i >= 0; i--) {
    const attr = dom.attributes[i]
    attrs.set(attr.name, attr.value)
  }
  return filter(dom.nodeName, attrs)
}

/**
 * Applies a filter on a type.
 *
 * @private
 * @function
 * @param {Y} y The Yjs instance.
 * @param {DomBinding} binding The DOM binding instance that has the dom filter.
 * @param {YXmlElement | YXmlFragment } type The type to apply the filter to.
 */
export const applyFilterOnType = (y, binding, type) => {
  if (isParentOf(binding.type, type) && type instanceof YXmlElement) {
    const nodeName = type.nodeName
    let attributes = new Map()
    if (type.getAttributes !== undefined) {
      let attrs = type.getAttributes()
      for (let key in attrs) {
        attributes.set(key, attrs[key])
      }
    }
    const filteredAttributes = binding.filter(nodeName, new Map(attributes))
    if (filteredAttributes === null) {
      type._delete(y, true)
    } else {
      // iterate original attributes
      attributes.forEach((value, key) => {
        // delete all attributes that are not in filteredAttributes
        if (filteredAttributes.has(key) === false) {
          type.removeAttribute(key)
        }
      })
    }
  }
}
