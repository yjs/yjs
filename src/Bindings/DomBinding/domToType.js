
import { YXmlText, YXmlElement, YXmlHook } from '../../Types/YXml/YXml.js'
import { createAssociation } from './util.js'

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
      if (hookName !== undefined) {
        hook = binding.opts.hooks[hookName]
        if (hook === undefined) {
          console.error(`Unknown hook "${hookName}". Deleting yjsHook dataset property.`)
          delete element.dataset.yjsHook
          hookName = undefined
        }
      }
      if (hookName === undefined) {
        type = new YXmlElement(element.nodeName)
        const attrs = element.attributes
        for (let i = attrs.length - 1; i >= 0; i--) {
          const attr = attrs[i]
          type.setAttribute(attr.name, attr.value)
        }
        const children = Array.from(element.childNodes).map(e => domToType(e, _document, binding))
        type.insert(0, children)
      } else {
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
