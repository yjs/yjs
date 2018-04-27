
import { YXmlText, YXmlElement, YXmlHook } from '../../Types/YXml/YXml.js'
import { createAssociation, domsToTypes } from './util.js'
import { filterDomAttributes, defaultFilter } from './filter.js'

/**
 * Creates a Yjs type (YXml) based on the contents of a DOM Element.
 *
 * @param {Element|TextNode} element The DOM Element
 * @param {?Document} _document Optional. Provide the global document object
 * @param {Hooks} [hooks = {}] Optional. Set of Yjs Hooks
 * @param {Filter} [filter=defaultFilter] Optional. Dom element filter
 * @param {?DomBinding} binding Warning: This property is for internal use only!
 * @return {YXmlElement | YXmlText}
 */
export default function domToType (element, _document = document, hooks = {}, filter = defaultFilter, binding) {
  let type
  switch (element.nodeType) {
    case _document.ELEMENT_NODE:
      let hookName = null
      let hook
      // configure `hookName !== undefined` if element is a hook.
      if (element.hasAttribute('data-yjs-hook')) {
        hookName = element.getAttribute('data-yjs-hook')
        hook = hooks[hookName]
        if (hook === undefined) {
          console.error(`Unknown hook "${hookName}". Deleting yjsHook dataset property.`)
          delete element.removeAttribute('data-yjs-hook')
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
      break
    case _document.TEXT_NODE:
      type = new YXmlText()
      type.insert(0, element.nodeValue)
      break
    default:
      throw new Error('Can\'t transform this node type to a YXml type!')
  }
  createAssociation(binding, element, type)
  return type
}
