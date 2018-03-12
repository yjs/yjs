import { YXmlText, YXmlHook } from './YXml.js'

export function defaultDomFilter (node, attributes) {
  return attributes
}

export function getAnchorViewPosition (scrollElement) {
  if (scrollElement == null) {
    return null
  }
  let anchor = document.getSelection().anchorNode
  if (anchor != null) {
    let top = getBoundingClientRect(anchor).top
    if (top >= 0 && top <= document.documentElement.clientHeight) {
      return {
        anchor: anchor,
        top: top
      }
    }
  }
  return {
    anchor: null,
    scrollTop: scrollElement.scrollTop,
    scrollHeight: scrollElement.scrollHeight
  }
}

// get BoundingClientRect that works on text nodes
export function getBoundingClientRect (element) {
  if (element.getBoundingClientRect != null) {
    // is element node
    return element.getBoundingClientRect()
  } else {
    // is text node
    if (element.parentNode == null) {
      // range requires that text nodes have a parent
      let span = document.createElement('span')
      span.appendChild(element)
    }
    let range = document.createRange()
    range.selectNode(element)
    return range.getBoundingClientRect()
  }
}

export function fixScrollPosition (scrollElement, fix) {
  if (scrollElement !== null && fix !== null) {
    if (fix.anchor === null) {
      if (scrollElement.scrollTop === fix.scrollTop) {
        scrollElement.scrollTop = scrollElement.scrollHeight - fix.scrollHeight
      }
    } else {
      scrollElement.scrollTop = getBoundingClientRect(fix.anchor).top - fix.top
    }
  }
}


export function reflectChangesOnDom (events, _document) {
  // Make sure that no filtered attributes are applied to the structure
  // if they were, delete them
  /*
  events.forEach(event => {
    const target = event.target
    if (event.attributesChanged === undefined) {
      // event.target is Y.XmlText
      return
    }
    const keys = this._domFilter(target.nodeName, Array.from(event.attributesChanged))
    if (keys === null) {
      target._delete()
    } else {
      const removeKeys = new Set() // is a copy of event.attributesChanged
      event.attributesChanged.forEach(key => { removeKeys.add(key) })
      keys.forEach(key => {
        // remove all accepted keys from removeKeys
        removeKeys.delete(key)
      })
      // remove the filtered attribute
      removeKeys.forEach(key => {
        target.removeAttribute(key)
      })
    }
  })
  */
  this._mutualExclude(() => {
    events.forEach(event => {
      const yxml = event.target
      const dom = yxml._dom
      if (dom != null) {
        // TODO: do this once before applying stuff
        // let anchorViewPosition = getAnchorViewPosition(yxml._scrollElement)
        if (yxml.constructor === YXmlText) {
          yxml._dom.nodeValue = yxml.toString()
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
            yxml.forEach(function (t) {
              let expectedChild = t.getDom(_document)
              if (expectedChild.parentNode === dom) {
                // is already attached to the dom. Look for it
                while (currentChild !== expectedChild) {
                  let del = currentChild
                  currentChild = currentChild.nextSibling
                  dom.removeChild(del)
                }
                currentChild = currentChild.nextSibling
              } else {
                // this dom is not yet attached to dom
                dom.insertBefore(expectedChild, currentChild)
              }
            })
            while (currentChild !== null) {
              let tmp = currentChild.nextSibling
              dom.removeChild(currentChild)
              currentChild = tmp
            }
          }
        }
        /* TODO: smartscrolling
        .. else if (event.type === 'childInserted' || event.type === 'insert') {
          let nodes = event.values
          for (let i = nodes.length - 1; i >= 0; i--) {
            let node = nodes[i]
            node.setDomFilter(yxml._domFilter)
            node.enableSmartScrolling(yxml._scrollElement)
            let dom = node.getDom()
            let fixPosition = null
            let nextDom = null
            if (yxml._content.length > event.index + i + 1) {
              nextDom = yxml.get(event.index + i + 1).getDom()
            }
            yxml._dom.insertBefore(dom, nextDom)
            if (anchorViewPosition === null) {
              // nop
            } else if (anchorViewPosition.anchor !== null) {
              // no scrolling when current selection
              if (!dom.contains(anchorViewPosition.anchor) && !anchorViewPosition.anchor.contains(dom)) {
                fixPosition = anchorViewPosition
              }
            } else if (getBoundingClientRect(dom).top <= 0) {
              // adjust scrolling if modified element is out of view,
              // there is no anchor element, and the browser did not adjust scrollTop (this is checked later)
              fixPosition = anchorViewPosition
            }
            fixScrollPosition(yxml._scrollElement, fixPosition)
          }
        } else if (event.type === 'childRemoved' || event.type === 'delete') {
          for (let i = event.values.length - 1; i >= 0; i--) {
            let dom = event.values[i]._dom
            let fixPosition = null
            if (anchorViewPosition === null) {
              // nop
            } else if (anchorViewPosition.anchor !== null) {
              // no scrolling when current selection
              if (!dom.contains(anchorViewPosition.anchor) && !anchorViewPosition.anchor.contains(dom)) {
                fixPosition = anchorViewPosition
              }
            } else if (getBoundingClientRect(dom).top <= 0) {
              // adjust scrolling if modified element is out of view,
              // there is no anchor element, and the browser did not adjust scrollTop (this is checked later)
              fixPosition = anchorViewPosition
            }
            dom.remove()
            fixScrollPosition(yxml._scrollElement, fixPosition)
          }
        }
        */
      }
    })
  })
}
