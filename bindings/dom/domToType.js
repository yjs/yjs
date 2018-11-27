/**
 * @module bindings/dom
 */

/* eslint-env browser */
import { YXmlText } from '../../types/YXmlText.js'
import { YXmlHook } from '../../types/YXmlHook.js'
import { YXmlElement } from '../../types/YXmlElement.js'
import { createAssociation, domsToTypes } from './util.js'
import { filterDomAttributes, defaultFilter } from './filter.js'
import { DomBinding } from './DomBinding.js' // eslint-disable-line

/**
 * @callback DomFilter
 * @param {string} nodeName
 * @param {Map<string, string>} attrs
 * @return {Map | null}
 */

/**
 * Creates a Yjs type (YXml) based on the contents of a DOM Element.
 *
 * @function
 * @param {Element|Text} element The DOM Element
 * @param {?Document} _document Optional. Provide the global document object
 * @param {Object<string, any>} [hooks = {}] Optional. Set of Yjs Hooks
 * @param {DomFilter} [filter=defaultFilter] Optional. Dom element filter
 * @param {?DomBinding} binding Warning: This property is for internal use only!
 * @return {YXmlElement | YXmlText | false}
 */
export const domToType = (element, _document = document, hooks = {}, filter = defaultFilter, binding) => {
  /**
   * @type {any}
   */
  let type = null
  if (element instanceof Element) {
    let hookName = null
    let hook
    // configure `hookName !== undefined` if element is a hook.
    if (element.hasAttribute('data-yjs-hook')) {
      hookName = element.getAttribute('data-yjs-hook')
      hook = hooks[hookName]
      if (hook === undefined) {
        console.error(`Unknown hook "${hookName}". Deleting yjsHook dataset property.`)
        element.removeAttribute('data-yjs-hook')
        hookName = null
      }
    }
    if (hookName === null) {
      // Not a hook
      const attrs = filterDomAttributes(element, filter)
      if (attrs === null) {
        type = false
      } else {
        type = new YXmlElement(element.nodeName)
        attrs.forEach((val, key) => {
          type.setAttribute(key, val)
        })
        type.insert(0, domsToTypes(element.childNodes, document, hooks, filter, binding))
      }
    } else {
      // Is a hook
      type = new YXmlHook(hookName)
      hook.fillType(element, type)
    }
  } else if (element instanceof Text) {
    type = new YXmlText()
    type.insert(0, element.nodeValue)
  } else {
    throw new Error('Can\'t transform this node type to a YXml type!')
  }
  createAssociation(binding, element, type)
  return type
}
