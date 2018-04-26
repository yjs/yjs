
import { YXmlText, YXmlElement, YXmlHook } from '../../Types/YXml/YXml.js'
import { createAssociation } from './util.js'
import { filterDomAttributes } from './filter.js'

/**
 * Creates a Yjs type (YXml) based on the contents of a DOM Element.
 *
 * @param {Element|TextNode} element The DOM Element
 * @param {?Document} _document Optional. Provide the global document object.
 * @param {?DomBinding} binding This property should only be set if the type
 *                              is going to be bound with the dom-binding.
 * @return {YXmlElement | YXmlText}
 */
export default function domToType (element, _document = document, binding) {
  let type
  switch (element.nodeType) {
    case _document.ELEMENT_NODE:
      let hookName = element.dataset.yjsHook
      let hook
      // configure `hookName !== undefined` if element is a hook.
      if (hookName !== undefined) {
        hook = binding.opts.hooks[hookName]
        if (hook === undefined) {
          console.error(`Unknown hook "${hookName}". Deleting yjsHook dataset property.`)
          delete element.dataset.yjsHook
          hookName = undefined
        }
      }
      if (hookName === undefined) {
        // Not a hook
        const attrs = filterDomAttributes(element, binding.filter)
        if (attrs === null) {
          type = false
        } else {
          type = new YXmlElement(element.nodeName)
          attrs.forEach((val, key) => {
            type.setAttribute(key, val)
          })
          const children = []
          for (let elem of element.childNodes) {
            const type = domToType(elem, _document, binding)
            if (type !== false) {
              children.push(type)
            }
          }
          type.insert(0, children)
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
