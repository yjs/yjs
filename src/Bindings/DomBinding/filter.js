import isParentOf from '../../Util/isParentOf.js'

/**
 * @callback DomFilter
 * @param {string} nodeName
 * @param {Map<string, string>} attrs
 * @return {Map | null}
 */

/**
 * Default filter method (does nothing).
 *
 * @param {String} nodeName The nodeName of the element
 * @param {Map} attrs Map of key-value pairs that are attributes of the node.
 * @return {Map | null} The allowed attributes or null, if the element should be
 *                      filtered.
 */
export function defaultFilter (nodeName, attrs) {
  // TODO: implement basic filter that filters out dangerous properties!
  return attrs
}

/**
 *
 */
export function filterDomAttributes (dom, filter) {
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
 * @param {Y} y The Yjs instance.
 * @param {DomBinding} binding The DOM binding instance that has the dom filter.
 * @param {YXmlElement | YXmlFragment } type The type to apply the filter to.
 *
 * @private
 */
export function applyFilterOnType (y, binding, type) {
  if (isParentOf(binding.type, type)) {
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
      type._delete(y)
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
