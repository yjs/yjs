/* global MutationObserver */

import { defaultDomFilter, applyChangesFromDom, reflectChangesOnDom } from './utils.js'
import { beforeTransactionSelectionFixer, afterTransactionSelectionFixer } from './selection.js'

import YArray from '../YArray.js'
import YXmlEvent from './YXmlEvent.js'
import { YXmlText, YXmlHook } from './YXml.js'
import { logID } from '../../MessageHandler/messageToString.js'
import diff from '../../Util/simpleDiff.js'

function domToYXml (parent, doms, _document) {
  const types = []
  doms.forEach(d => {
    if (d._yxml != null && d._yxml !== false) {
      d._yxml._unbindFromDom()
    }
    if (parent._domFilter(d.nodeName, new Map()) !== null) {
      let type
      const hookName = d._yjsHook || (d.dataset != null ? d.dataset.yjsHook : undefined)
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

/**
 * Define the elements to which a set of CSS queries apply.
 * {@link https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors|CSS_Selectors}
 *
 * @example
 *   query = '.classSelector'
 *   query = 'nodeSelector'
 *   query = '#idSelector'
 *
 * @typedef {string} CSS_Selector
 */

/**
 * Represents a subset of the nodes of a YXmlElement / YXmlFragment and a
 * position within them.
 *
 * Can be created with {@link YXmlFragment#createTreeWalker}
 */
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
  /**
   * Get the next node.
   *
   * @return {YXmlElement} The next node.
   */
  next () {
    let n = this._currentNode
    if (this._firstCall) {
      this._firstCall = false
      if (!n._deleted && this._filter(n)) {
        return { value: n, done: false }
      }
    }
    do {
      if (!n._deleted && (n.constructor === YXmlFragment._YXmlElement || n.constructor === YXmlFragment) && n._start !== null) {
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

/**
 * Represents a list of {@link YXmlElement}.
 * A YxmlFragment does not have a nodeName and it does not have attributes.
 * Therefore it also must not be added as a childElement.
 */
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
        /*
        if (this._domObserver !== null) {
          this._domObserver.takeRecords()
        }
        */
        token = true
      }
    }
  }

  /**
   * Create a subtree of childNodes.
   *
   * @param {Function} filter Function that is called on each child element and
   *                          returns a Boolean indicating whether the child
   *                          is to be included in the subtree.
   * @return {TreeWalker} A subtree and a position within it.
   */
  createTreeWalker (filter) {
    return new YXmlTreeWalker(this, filter)
  }

  /**
   * Returns the first YXmlElement that matches the query.
   * Similar to DOM's {@link querySelector}.
   *
   * Query support:
   *   - tagname
   * TODO:
   *   - id
   *   - attribute
   *
   * @param {CSS_Selector} query The query on the children.
   * @return {?YXmlElement} The first element that matches the query or null.
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

  /**
   * Returns all YXmlElements that match the query.
   * Similar to Dom's {@link querySelectorAll}.
   *
   * TODO: Does not yet support all queries. Currently only query by tagName.
   *
   * @param {CSS_Selector} query The query on the children
   * @return {Array<YXmlElement>} The elements that match this query.
   */
  querySelectorAll (query) {
    query = query.toUpperCase()
    return Array.from(new YXmlTreeWalker(this, element => element.nodeName === query))
  }

  /**
   * Enables the smart scrolling functionality for a Dom Binding.
   * This is useful when YXml is bound to a shared editor. When activated,
   * the viewport will be changed to accommodate remote changes.
   *
   * @TODO: Disabled for now.
   *
   * @param {Element} scrollElement The node that is
   */
  enableSmartScrolling (scrollElement) {
    this._scrollElement = scrollElement
    this.forEach(xml => {
      xml.enableSmartScrolling(scrollElement)
    })
  }

  /**
   * Dom filter function.
   *
   * @callback domFilter
   * @param {string} nodeName The nodeName of the element
   * @param {Map} attributes The map of attributes.
   * @return {boolean} Whether to include the Dom node in the YXmlElement.
   */

  /**
   * Filter out Dom elements.
   *
   * @param {domFilter} f The filtering function that decides whether to include
   *                      a Dom node.
   */
  setDomFilter (f) {
    this._domFilter = f
    let attributes = new Map()
    if (this.getAttributes !== undefined) {
      let attrs = this.getAttributes()
      for (let key in attrs) {
        attributes.set(key, attrs[key])
      }
    }
    this._y.transact(() => {
      let result = this._domFilter(this.nodeName, new Map(attributes))
      if (result === null) {
        this._delete(this._y)
      } else {
        attributes.forEach((value, key) => {
          if (!result.has(key)) {
            this.removeAttribute(key)
          }
        })
      }
      this.forEach(xml => {
        xml.setDomFilter(f)
      })
    })
  }

  /**
   * @private
   * Creates YArray Event and calls observers.
   */
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YXmlEvent(this, parentSubs, remote))
  }

  /**
   * Get the string representation of all the children of this YXmlFragment.
   *
   * @return {string} The string representation of all children.
   */
  toString () {
    return this.map(xml => xml.toString()).join('')
  }

  /**
   * @private
   * Unbind from Dom and mark this Item as deleted.
   *
   * @param {Y} y The Yjs instance
   * @param {boolean} createDelete Whether to propagate a message that this
   *                               Type was deleted.
   */
  _delete (y, createDelete) {
    this._unbindFromDom()
    super._delete(y, createDelete)
  }

  /**
   * @private
   * Unbind this YXmlFragment from the Dom.
   */
  _unbindFromDom () {
    if (this._domObserver != null) {
      this._domObserver.disconnect()
      this._domObserver = null
    }
    if (this._dom != null) {
      this._dom._yxml = null
      this._dom = null
    }
    if (this._beforeTransactionHandler !== undefined) {
      this._y.off('beforeTransaction', this._beforeTransactionHandler)
    }
  }

  /**
   * Insert Dom Elements after one of the children of this YXmlFragment.
   * The Dom elements will be bound to a new YXmlElement and inserted at the
   * specified position.
   *
   * @param {YXmlElement|null} prev The reference node. New YxmlElements are
   *                           inserted after this node. Set null to insert at
   *                           the beginning.
   * @param {Array<Element>} doms The Dom elements to insert.
   * @param {?Document} _document Optional. Provide the global document object.
   * @return {Array<YXmlElement>} The YxmlElements that are inserted.
   */
  insertDomElementsAfter (prev, doms, _document) {
    const types = domToYXml(this, doms, _document)
    this.insertAfter(prev, types)
    return types
  }

  /**
   * Insert Dom Elements at a specified index.
   * The Dom elements will be bound to a new YXmlElement and inserted at the
   * specified position.
   *
   * @param {Integer} index The position to insert elements at.
   * @param {Array<Element>} doms The Dom elements to insert.
   * @param {?Document} _document Optional. Provide the global document object.
   * @return {Array<YXmlElement>} The YxmlElements that are inserted.
   */
  insertDomElements (index, doms, _document) {
    const types = domToYXml(this, doms, _document)
    this.insert(index, types)
    return types
  }

  /**
   * Get the Dom representation of this YXml type..
   */
  getDom () {
    return this._dom
  }

  /**
   * Bind this YXmlFragment and all its children to a Dom Element.
   * The content of the Dom Element are replaced with the Dom representation of
   * the children of this YXml Type.
   *
   * @param {Element} dom The Dom Element that should be bound to this Type.
   * @param {?Document} _document Optional. Provide the global document object.
   */
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

  /**
   * @private
   * Binds to a dom element.
   * Only call if dom and YXml are isomorph
   */
  _bindToDom (dom, _document) {
    _document = _document || document
    this._dom = dom
    dom._yxml = this
    if (this._parent === null) {
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
      this._beforeTransactionHandler = () => {
        this._domObserverListener(this._domObserver.takeRecords())
      }
      this._y.on('beforeTransaction', this._beforeTransactionHandler)
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
              if (dom.yOnChildrenChanged !== undefined) {
                dom.yOnChildrenChanged()
              }
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

  /**
   * @private
   * Transform this YXml Type to a readable format.
   * Useful for logging as all Items implement this method.
   */
  _logString () {
    const left = this._left !== null ? this._left._lastId : null
    const origin = this._origin !== null ? this._origin._lastId : null
    return `YXml(id:${logID(this._id)},left:${logID(left)},origin:${logID(origin)},right:${this._right},parent:${logID(this._parent)},parentSub:${this._parentSub})`
  }
}
