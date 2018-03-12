/* global MutationObserver */

import Binding from './Binding.js'
import diff from '../Util/simpleDiff.js'
import YXmlFragment from '../../Type/YXml/YXmlFragment.js'
import YXmlHook from '../../Type/YXml/YXmlHook.js'


function defaultFilter (nodeName, attrs) {
  return attrs
}

function applyFilter (target, filter, type) {
  if (type._deleted) {
    return
  }
  // check if type is a child of this
  let isChild = false
  let p = type
  while (p !== undefined) {
    if (p === target) {
      isChild = true
      break
    }
    p = p._parent
  }
  if (!isChild) {
    return
  }
  // filter attributes
  const attributes = new Map()
  if (type.getAttributes !== undefined) {
    let attrs = type.getAttributes()
    for (let key in attrs) {
      attributes.set(key, attrs[key])
    }
  }
  let result = filter(type.nodeName, new Map(attributes))
  if (result === null) {
    type._delete(this._y)
  } else {
    attributes.forEach((value, key) => {
      if (!result.has(key)) {
        type.removeAttribute(key)
      }
    })
  }
}

function typeObserver (events) {
  this._mutualExclude(() => {
    reflectChangesOnDom.call(this, events)
  })
}

function domObserver (mutations) {
  this._mutualExclude(() => {
    this._y.transact(() => {
      let diffChildren = new Set()
      mutations.forEach(mutation => {
        const dom = mutation.target
        const yxml = this.domToYXml.get(dom._yxml)
        if (yxml == null || yxml.constructor === YXmlHook) {
          // dom element is filtered
          return
        }
        switch (mutation.type) {
          case 'characterData':
            var change = diff(yxml.toString(), dom.nodeValue)
            yxml.delete(change.pos, change.remove)
            yxml.insert(change.pos, change.insert)
            break
          case 'attributes':
            if (yxml.constructor === YXmlFragment) {
              break
            }
            let name = mutation.attributeName
            let val = dom.getAttribute(name)
            // check if filter accepts attribute
            let attributes = new Map()
            attributes.set(name, val)
            if (this.filter(dom.nodeName, attributes).size > 0 && yxml.constructor !== YXmlFragment) {
              if (yxml.getAttribute(name) !== val) {
                if (val == null) {
                  yxml.removeAttribute(name)
                } else {
                  yxml.setAttribute(name, val)
                }
              }
            }
            break
          case 'childList':
            diffChildren.add(mutation.target)
            break
        }
      })
      for (let dom of diffChildren) {
        if (dom.yOnChildrenChanged !== undefined) {
          dom.yOnChildrenChanged()
        }
        const yxml = this.domToType.get(dom)
        applyChangesFromDom(dom, yxml)
      }
    })
  })
}

/**
 * A binding that binds the children of a YXmlFragment to a DOM element.
 *
 * This binding is automatically destroyed when its parent is deleted.
 *
 * @example
 *   const div = document.createElement('div')
 *   const type = y.define('xml', Y.XmlFragment)
 *   const binding = new Y.QuillBinding(type, div)
 *
 */
export default class DomBinding extends Binding {
  /**
   * @param {YXmlFragment} type The bind source. This is the ultimate source of
   *                            truth.
   * @param {Element} target The bind target. Mirrors the target.
   */
  constructor (type, target, opts) {
    // Binding handles textType as this.type and domTextarea as this.target
    super(type, target)
    this.domToType = new Map()
    this.typeToDom = new Map()
    this.filter = opts.filter || defaultFilter
    // set initial value
    target.innerHTML = ''
    for (let child of type) {
      target.insertBefore(child.toDom(this.domToType, this.typeToDom), null)
    }
    this._typeObserver = typeObserver.bind(this)
    this._domObserver = domObserver.bind(this)
    type.observe(this._typeObserver)
    this._domObserver = domObserver.bind(this)
    this._mutationObserver = new MutationObserver(this._domObserver())
    this._mutationObserver.observe(target, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true
    })
    this._beforeTransactionHandler = () => {
      this._domObserverListener(this._domObserver.takeRecords())
    }
    this._y.on('beforeTransaction', this._beforeTransactionHandler)
  }

  /**
   * Remove all properties that are handled by this class
   */
  destroy () {
    this.domToType = null
    this.typeToDom = null
    this.type.unobserve(this._typeObserver)
    this._mutationObserver.disconnect()
    this.type._y.off('beforeTransaction', this._beforeTransactionHandler)
    super.destroy()
  }
}
