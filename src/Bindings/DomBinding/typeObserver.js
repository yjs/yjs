
import YXmlText from '../../Types/YXml/YXmlText.js'
import YXmlHook from '../../Types/YXml/YXmlHook.js'
import { removeDomChildrenUntilElementFound } from './util.js'

/**
 * @private
 */
export default function typeObserver (events, _document) {
  this._mutualExclude(() => {
    events.forEach(event => {
      const yxml = event.target
      const dom = this.typeToDom.get(yxml)
      if (dom !== undefined && dom !== false) {
        if (yxml.constructor === YXmlText) {
          dom.nodeValue = yxml.toString()
          // TODO: use hasOwnProperty instead of === undefined check
        } else if (event.attributesChanged !== undefined) {
          // update attributes
          event.attributesChanged.forEach(attributeName => {
            const value = yxml.getAttribute(attributeName)
            if (value === undefined) {
              dom.removeAttribute(attributeName)
            } else {
              dom.setAttribute(attributeName, value)
            }
          })
          /*
           * TODO: instead of hard-checking the types, it would be best to
           *       specify the type's features. E.g.
           *         - _yxmlHasAttributes
           *         - _yxmlHasChildren
           *       Furthermore, the features shouldn't be encoded in the types,
           *       only in the attributes (above)
           */
          if (event.childListChanged && yxml.constructor !== YXmlHook) {
            let currentChild = dom.firstChild
            yxml.forEach(childType => {
              const childNode = this.typeToDom.get(childType)
              const binding = this
              switch (childNode) {
                case undefined:
                  // Does not exist. Create it.
                  const node = childType.toDom(_document, binding)
                  dom.insertBefore(node, currentChild)
                  break
                case false:
                  // nop
                  break
                default:
                  // Is already attached to the dom.
                  // Find it and remove all dom nodes in-between.
                  removeDomChildrenUntilElementFound(dom, currentChild, childNode)
                  currentChild = childNode.nextSibling
                  break
              }
            })
            removeDomChildrenUntilElementFound(dom, currentChild, null)
          }
        }
      }
    })
  })
}
