/* global MutationObserver */

import Binding from '../Binding.js'
import { createAssociation, removeAssociation } from './util.js'
import { beforeTransactionSelectionFixer, afterTransactionSelectionFixer } from './selection.js'
import { defaultFilter, applyFilterOnType } from './filter.js'
import typeObserver from './typeObserver.js'
import domObserver from './domObserver.js'

/**
 * A binding that binds the children of a YXmlFragment to a DOM element.
 *
 * This binding is automatically destroyed when its parent is deleted.
 *
 * @example
 * const div = document.createElement('div')
 * const type = y.define('xml', Y.XmlFragment)
 * const binding = new Y.QuillBinding(type, div)
 *
 */
export default class DomBinding extends Binding {
  /**
   * @param {YXmlFragment} type The bind source. This is the ultimate source of
   *                            truth.
   * @param {Element} target The bind target. Mirrors the target.
   * @param {Object} [opts] Optional configurations

   * @param {FilterFunction} [opts.filter=defaultFilter] The filter function to use.
   */
  constructor (type, target, opts = {}) {
    // Binding handles textType as this.type and domTextarea as this.target
    super(type, target)
    this.opts = opts
    opts.document = opts.document || document
    opts.hooks = opts.hooks || {}
    this.scrollingElement = opts.scrollingElement || null
    /**
     * Maps each DOM element to the type that it is associated with.
     * @type {Map}
     */
    this.domToType = new Map()
    /**
     * Maps each YXml type to the DOM element that it is associated with.
     * @type {Map}
     */
    this.typeToDom = new Map()
    /**
     * Defines which DOM attributes and elements to filter out.
     * Also filters remote changes.
     * @type {FilterFunction}
     */
    this.filter = opts.filter || defaultFilter
    // set initial value
    target.innerHTML = ''
    type.forEach(child => {
      target.insertBefore(child.toDom(opts.document, opts.hooks, this), null)
    })
    this._typeObserver = typeObserver.bind(this)
    this._domObserver = (mutations) => {
      domObserver.call(this, mutations, opts.document)
    }
    type.observeDeep(this._typeObserver)
    this._mutationObserver = new MutationObserver(this._domObserver)
    this._mutationObserver.observe(target, {
      childList: true,
      attributes: true,
      characterData: true,
      subtree: true
    })
    const y = type._y
    // Force flush dom changes before Type changes are applied (they might
    // modify the dom)
    this._beforeTransactionHandler = (y, transaction, remote) => {
      this._domObserver(this._mutationObserver.takeRecords())
      beforeTransactionSelectionFixer(y, this, transaction, remote)
    }
    y.on('beforeTransaction', this._beforeTransactionHandler)
    this._afterTransactionHandler = (y, transaction, remote) => {
      afterTransactionSelectionFixer(y, this, transaction, remote)
      // remove associations
      // TODO: this could be done more efficiently
      // e.g. Always delete using the following approach, or removeAssociation
      // in dom/type-observer..
      transaction.deletedStructs.forEach(type => {
        const dom = this.typeToDom.get(type)
        if (dom !== undefined) {
          removeAssociation(this, dom, type)
        }
      })
    }
    y.on('afterTransaction', this._afterTransactionHandler)
    // Before calling observers, apply dom filter to all changed and new types.
    this._beforeObserverCallsHandler = (y, transaction) => {
      // Apply dom filter to new and changed types
      transaction.changedTypes.forEach((subs, type) => {
        // Only check attributes. New types are filtered below.
        if ((subs.size > 1 || (subs.size === 1 && subs.has(null) === false))) {
          applyFilterOnType(y, this, type)
        }
      })
      transaction.newTypes.forEach(type => {
        applyFilterOnType(y, this, type)
      })
    }
    y.on('beforeObserverCalls', this._beforeObserverCallsHandler)
    createAssociation(this, target, type)
  }

  /**
   * NOTE: currently does not apply filter to existing elements!
   * @param {FilterFunction} filter The filter function to use from now on.
   */
  setFilter (filter) {
    this.filter = filter
    // TODO: apply filter to all elements
  }

  /**
   * Remove all properties that are handled by this class.
   */
  destroy () {
    this.domToType = null
    this.typeToDom = null
    this.type.unobserveDeep(this._typeObserver)
    this._mutationObserver.disconnect()
    const y = this.type._y
    y.off('beforeTransaction', this._beforeTransactionHandler)
    y.off('beforeObserverCalls', this._beforeObserverCallsHandler)
    y.off('afterTransaction', this._afterTransactionHandler)
    super.destroy()
  }
}

  /**
   * A filter defines which elements and attributes to share.
   * Return null if the node should be filtered. Otherwise return the Map of
   * accepted attributes.
   *
   * @typedef {function(nodeName: String, attrs: Map): Map|null} FilterFunction
   */
