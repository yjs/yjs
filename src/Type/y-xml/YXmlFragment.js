/* global MutationObserver */

import { defaultDomFilter, applyChangesFromDom, reflectChangesOnDom } from './utils.js'
import { beforeTransactionSelectionFixer, afterTransactionSelectionFixer } from './selection.js'

import YArray from '../YArray.js'
import YXmlEvent from './YXmlEvent.js'
import { YXmlText, YXmlHook } from './y-xml'
import { logID } from '../../MessageHandler/messageToString.js'
import diff from 'fast-diff'

function domToYXml (parent, doms, _document) {
  const types = []
  doms.forEach(d => {
    if (d._yxml != null && d._yxml !== false) {
      d._yxml._unbindFromDom()
    }
    if (parent._domFilter(d.nodeName, new Map()) !== null) {
      let type
      const hookName = d._yjsHook
      if (hookName !== undefined) {
        type = new YXmlHook(hookName, d)
      } else if (d.nodeType === d.TEXT_NODE) {
        type = new YXmlText(d)
      } else if (d.nodeType === d.ELEMENT_NODE) {
        type = new YXmlFragment._YXmlElement(d, parent._domFilter, _document)
      } else {
        throw new Error('Unsupported node!')
      }
      // type.enableSmartScrolling(parent._scrollElement)
      types.push(type)
    } else {
      d._yxml = false
    }
  })
  return types
}

class YXmlTreeWalker {
  constructor (root, f) {
    this._filter = f || (() => true)
    this._root = root
    this._currentNode = root
    this._firstCall = true
  }
  [Symbol.iterator] () {
    return this
  }
  next () {
    let n = this._currentNode
    if (this._firstCall) {
      this._firstCall = false
      if (!n._deleted && this._filter(n)) {
        return { value: n, done: false }
      }
    }
    do {
      if (!n._deleted && n.constructor === YXmlFragment._YXmlElement && n._start !== null) {
        // walk down in the tree
        n = n._start
      } else {
        // walk right or up in the tree
        while (n !== this._root) {
          if (n._right !== null) {
            n = n._right
            break
          }
          n = n._parent
        }
        if (n === this._root) {
          n = null
        }
      }
      if (n === this._root) {
        break
      }
    } while (n !== null && (n._deleted || !this._filter(n)))
    this._currentNode = n
    if (n === null) {
      return { done: true }
    } else {
      return { value: n, done: false }
    }
  }
}

export default class YXmlFragment extends YArray {
  constructor () {
    super()
    this._dom = null
    this._domFilter = defaultDomFilter
    this._domObserver = null
    // this function makes sure that either the
    // dom event is executed, or the yjs observer is executed
    var token = true
    this._mutualExclude = f => {
      if (token) {
        token = false
        try {
          f()
        } catch (e) {
          console.error(e)
        }
        if (this._domObserver !== null) {
          this._domObserver.takeRecords()
        }
        token = true
      }
    }
  }
  createTreeWalker (filter) {
    return new YXmlTreeWalker(this, filter)
  }
  /**
   * Retrieve first element that matches *query*
   * Similar to DOM's querySelector, but only accepts a subset of its queries
   *
   * Query support:
   *   - tagname
   * TODO:
   *   - id
   *   - attribute
   */
  querySelector (query) {
    query = query.toUpperCase()
    const iterator = new YXmlTreeWalker(this, element => element.nodeName === query)
    const next = iterator.next()
    if (next.done) {
      return null
    } else {
      return next.value
    }
  }
  querySelectorAll (query) {
    query = query.toUpperCase()
    return Array.from(new YXmlTreeWalker(this, element => element.nodeName === query))
  }
  enableSmartScrolling (scrollElement) {
    this._scrollElement = scrollElement
    this.forEach(xml => {
      xml.enableSmartScrolling(scrollElement)
    })
  }
  setDomFilter (f) {
    this._domFilter = f
    this.forEach(xml => {
      xml.setDomFilter(f)
    })
  }
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YXmlEvent(this, parentSubs, remote))
  }
  toString () {
    return this.map(xml => xml.toString()).join('')
  }
  _delete (y, createDelete) {
    this._unbindFromDom()
    super._delete(y, createDelete)
  }
  _unbindFromDom () {
    if (this._domObserver != null) {
      this._domObserver.disconnect()
      this._domObserver = null
    }
    if (this._dom != null) {
      this._dom._yxml = null
      this._dom = null
    }
  }
  insertDomElementsAfter (prev, doms, _document) {
    const types = domToYXml(this, doms, _document)
    this.insertAfter(prev, types)
    return types
  }
  insertDomElements (pos, doms, _document) {
    const types = domToYXml(this, doms, _document)
    this.insert(pos, types)
    return types
  }
  getDom () {
    return this._dom
  }
  bindToDom (dom, _document) {
    if (this._dom != null) {
      this._unbindFromDom()
    }
    if (dom._yxml != null) {
      dom._yxml._unbindFromDom()
    }
    dom.innerHTML = ''
    this.forEach(t => {
      dom.insertBefore(t.getDom(_document), null)
    })
    this._bindToDom(dom, _document)
  }
  // binds to a dom element
  // Only call if dom and YXml are isomorph
  _bindToDom (dom, _document) {
    _document = _document || document
    this._dom = dom
    dom._yxml = this
    // TODO: refine this..
    if ((this.constructor !== YXmlFragment && this._parent !== this._y) || this._parent === null) {
      // TODO: only top level YXmlFragment can bind. Also allow YXmlElements..
      return
    }
    this._y.on('beforeTransaction', beforeTransactionSelectionFixer)
    this._y.on('afterTransaction', afterTransactionSelectionFixer)
    const applyFilter = (type) => {
      if (type._deleted) {
        return
      }
      // check if type is a child of this
      let isChild = false
      let p = type
      while (p !== this._y) {
        if (p === this) {
          isChild = true
          break
        }
        p = p._parent
      }
      if (!isChild) {
        return
      }
      // filter attributes
      let attributes = new Map()
      if (type.getAttributes !== undefined) {
        let attrs = type.getAttributes()
        for (let key in attrs) {
          attributes.set(key, attrs[key])
        }
      }
      let result = this._domFilter(type.nodeName, new Map(attributes))
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
    this._y.on('beforeObserverCalls', function (y, transaction) {
      // apply dom filter to new and changed types
      transaction.changedTypes.forEach(function (subs, type) {
        if (subs.size > 1 || !subs.has(null)) {
          // only apply changes on attributes
          applyFilter(type)
        }
      })
      transaction.newTypes.forEach(applyFilter)
    })
    // Apply Y.Xml events to dom
    this.observeDeep(events => {
      reflectChangesOnDom.call(this, events, _document)
    })
    // Apply Dom changes on Y.Xml
    if (typeof MutationObserver !== 'undefined') {
      this._y.on('beforeTransaction', () => {
        this._domObserverListener(this._domObserver.takeRecords())
      })
      this._domObserverListener = mutations => {
        this._mutualExclude(() => {
          this._y.transact(() => {
            let diffChildren = new Set()
            mutations.forEach(mutation => {
              const dom = mutation.target
              const yxml = dom._yxml
              if (yxml == null || yxml.constructor === YXmlHook) {
                // dom element is filtered
                return
              }
              switch (mutation.type) {
                case 'characterData':
                  var diffs = diff(yxml.toString(), dom.nodeValue)
                  var pos = 0
                  for (var i = 0; i < diffs.length; i++) {
                    var d = diffs[i]
                    if (d[0] === 0) { // EQUAL
                      pos += d[1].length
                    } else if (d[0] === -1) { // DELETE
                      yxml.delete(pos, d[1].length)
                    } else { // INSERT
                      yxml.insert(pos, d[1])
                      pos += d[1].length
                    }
                  }
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
                  if (this._domFilter(dom.nodeName, attributes).size > 0 && yxml.constructor !== YXmlFragment) {
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
              if (dom._yxml != null && dom._yxml !== false) {
                applyChangesFromDom(dom)
              }
            }
          })
        })
      }
      this._domObserver = new MutationObserver(this._domObserverListener)
      this._domObserver.observe(dom, {
        childList: true,
        attributes: true,
        characterData: true,
        subtree: true
      })
    }
    return dom
  }
  _logString () {
    const left = this._left !== null ? this._left._lastId : null
    const origin = this._origin !== null ? this._origin._lastId : null
    return `YXml(id:${logID(this._id)},left:${logID(left)},origin:${logID(origin)},right:${this._right},parent:${logID(this._parent)},parentSub:${this._parentSub})`
  }
}
