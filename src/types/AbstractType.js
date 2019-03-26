/**
 * @module structs
 */

import { Y } from '../utils/Y.js' // eslint-disable-line
import { EventHandler } from '../utils/EventHandler.js'
import { YEvent } from '../utils/YEvent.js'
import { AbstractItem } from '../structs/AbstractItem.js' // eslint-disable-line
import { ItemType } from '../structs/ItemType.js' // eslint-disable-line
import { Encoder } from 'lib0/encoding.js' // eslint-disable-line
import { Transaction, nextID } from '../utils/Transaction.js' // eslint-disable-line

/**
 * Restructure children as if they were inserted one after another
 * @param {Transaction} transaction
 * @param {AbstractItem} start
 */
const integrateChildren = (transaction, start) => {
  let right
  while (true) {
    right = start.right
    start.id = nextID(transaction)
    start.right = null
    start.rightOrigin = null
    start.origin = start.left
    start.integrate(transaction)
    if (right !== null) {
      start = right
    } else {
      break
    }
  }
}

/**
 * Abstract Yjs Type class
 */
export class AbstractType {
  constructor () {
    /**
     * @type {ItemType|null}
     */
    this._item = null
    /**
     * @private
     * @type {Map<string,AbstractItem>}
     */
    this._map = new Map()
    /**
     * @private
     * @type {AbstractItem|null}
     */
    this._start = null
    /**
     * @private
     * @type {Y|null}
     */
    this._y = null
    this._length = 0
    this._eventHandler = new EventHandler()
    this._deepEventHandler = new EventHandler()
  }

  /**
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Transaction} transaction The Yjs instance
   * @param {ItemType} item
   * @private
   */
  _integrate (transaction, item) {
    this._y = transaction.y
    this._item = item
    // when integrating children we must make sure to
    // integrate start
    const start = this._start
    if (start !== null) {
      this._start = null
      integrateChildren(transaction, start)
    }
    // integrate map children_integrate
    const map = this._map
    this._map = new Map()
    map.forEach(t => {
      t.right = null
      t.rightOrigin = null
      integrateChildren(transaction, t)
    })
  }

  /**
   * @return {AbstractType}
   */
  _copy () {
    throw new Error('unimplemented')
  }

  /**
   * @param {Encoder} encoder
   */
  _write (encoder) {
    throw new Error('unimplemented')
  }

  /**
   * The first non-deleted item
   */
  get _first () {
    let n = this._start
    while (n !== null && n.deleted) {
      n = n.right
    }
    return n
  }

  /**
   * Creates YArray Event and calls observers.
   * @private
   */
  _callObserver (transaction, parentSubs, remote) {
    this._callEventHandler(transaction, new YEvent(this))
  }

  /**
   * Call event listeners with an event. This will also add an event to all
   * parents (for `.observeDeep` handlers).
   * @private
   */
  _callEventHandler (transaction, event) {
    const changedParentTypes = transaction.changedParentTypes
    this._eventHandler.callEventListeners(transaction, event)
    /**
     * @type {any}
     */
    let type = this
    while (type !== this._y) {
      let events = changedParentTypes.get(type)
      if (events === undefined) {
        events = []
        changedParentTypes.set(type, events)
      }
      events.push(event)
      type = type._parent
    }
  }

  /**
   * Helper method to transact if the y instance is available.
   *
   * TODO: Currently event handlers are not thrown when a type is not registered
   *       with a Yjs instance.
   * @private
   */
  _transact (f) {
    const y = this._y
    if (y !== null) {
      y.transact(f)
    } else {
      f(y)
    }
  }

  /**
   * Observe all events that are created on this type.
   *
   * @param {Function} f Observer function
   */
  observe (f) {
    this._eventHandler.addEventListener(f)
  }

  /**
   * Observe all events that are created by this type and its children.
   *
   * @param {Function} f Observer function
   */
  observeDeep (f) {
    this._deepEventHandler.addEventListener(f)
  }

  /**
   * Unregister an observer function.
   *
   * @param {Function} f Observer function
   */
  unobserve (f) {
    this._eventHandler.removeEventListener(f)
  }

  /**
   * Unregister an observer function.
   *
   * @param {Function} f Observer function
   */
  unobserveDeep (f) {
    this._deepEventHandler.removeEventListener(f)
  }

  /**
   * @abstract
   * @return {Object | Array | number | string}
   */
  toJSON () {}
}

/**
 * @param {AbstractType} type
 * @return {Array<any>}
 */
export const typeToArray = type => {

}

/**
 * Executes a provided function on once on overy element of this YArray.
 *
 * @param {AbstractType} type
 * @param {function(any,number,AbstractType):void} f A function to execute on every element of this YArray.
 * @param {HistorySnapshot} [snapshot]
 */
export const typeForEach = (type, f, snapshot) => {
  let index = 0
  let n = type._start
  while (n !== null) {
    if (isVisible(n, snapshot) && n._countable) {
      const c = n.getContent()
      for (let i = 0; i < c.length; i++) {
        f(c[i], index++, type)
      }
    }
    n = n._right
  }
}
