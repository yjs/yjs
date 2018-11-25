/**
 * @module bindings/dom
 */

import { isParentOf } from '../../utils/isParentOf.js'
import * as Y from '../../index.js'
import { DomBinding } from './DomBinding.js' // eslint-disable-line

/**
 * Default filter method (does nothing).
 *
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
 *
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
 * @param {Y.Y} y The Yjs instance.
 * @param {DomBinding} binding The DOM binding instance that has the dom filter.
 * @param {Y.XmlElement | Y.XmlFragment } type The type to apply the filter to.
 *
 * @private
 */
export const applyFilterOnType = (y, binding, type) => {
  if (isParentOf(binding.type, type) && type instanceof Y.XmlElement) {
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
