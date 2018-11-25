/**
 * @module bindings/dom
 */

/* eslint-env browser */
/* global getSelection */

import { YXmlText } from '../../types/YXmlText.js'
import { YXmlHook } from '../../types/YXmlHook.js'
import { removeDomChildrenUntilElementFound } from './util.js'

const findScrollReference = scrollingElement => {
  if (scrollingElement !== null) {
    let anchor = getSelection().anchorNode
    if (anchor == null) {
      let children = scrollingElement.children // only iterate through non-text nodes
      for (let i = 0; i < children.length; i++) {
        const elem = children[i]
        const rect = elem.getBoundingClientRect()
        if (rect.top >= 0) {
          return { elem, top: rect.top }
        }
      }
    } else {
      /**
       * @type {Element}
       */
      let elem = anchor.parentElement
      if (anchor instanceof Element) {
        elem = anchor
      }
      return {
        elem,
        top: elem.getBoundingClientRect().top
      }
    }
  }
  return null
}

const fixScroll = (scrollingElement, ref) => {
  if (ref !== null) {
    const { elem, top } = ref
    const currentTop = elem.getBoundingClientRect().top
    const newScroll = scrollingElement.scrollTop + currentTop - top
    if (newScroll >= 0) {
      scrollingElement.scrollTop = newScroll
    }
  }
}

/**
 * @private
 */
export const typeObserver = function (events) {
  this._mutualExclude(() => {
    const scrollRef = findScrollReference(this.scrollingElement)
    events.forEach(event => {
      const yxml = event.target
      const dom = this.typeToDom.get(yxml)
      if (dom !== undefined && dom !== false) {
        if (yxml.constructor === YXmlText) {
          dom.nodeValue = yxml.toString()
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
              switch (childNode) {
                case undefined:
                  // Does not exist. Create it.
                  const node = childType.toDom(this.opts.document, this.opts.hooks, this)
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
    fixScroll(this.scrollingElement, scrollRef)
  })
}
