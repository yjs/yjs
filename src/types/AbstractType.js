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
import * as map from 'lib0/map.js'
import { isVisible, Snapshot } from '../utils/Snapshot.js' // eslint-disable-line
import { ItemJSON } from '../structs/ItemJSON.js'
import { ItemBinary } from '../structs/ItemBinary.js'
import { ID, createID } from '../utils/ID.js' // eslint-disable-line
import { getItemCleanStart } from '../utils/StructStore.js'

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
   * Creates YEvent and calls observers.
   * @private
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
   */
  _callObserver (transaction, parentSubs) {
    this._callEventHandler(transaction, new YEvent(this))
  }

  /**
   * Call event listeners with an event. This will also add an event to all
   * parents (for `.observeDeep` handlers).
   * @private
   *
   * @param {Transaction} transaction
   * @param {any} event
   */
  _callEventHandler (transaction, event) {
    const changedParentTypes = transaction.changedParentTypes
    this._eventHandler.callEventListeners(transaction, event)
    /**
     * @type {AbstractType}
     */
    let type = this
    while (true) {
      map.setIfUndefined(changedParentTypes, type, () => []).push(event)
      if (type._item === null) {
        break
      }
      type = type._item.parent
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
export const typeArrayToArray = type => {
  const cs = []
  let n = type._start
  while (n !== null) {
    if (n.countable && !n.deleted) {
      const c = n.getContent()
      for (let i = 0; i < c.length; i++) {
        cs.push(c[i])
      }
    }
    n = n.right
  }
  return cs
}

/**
 * Executes a provided function on once on overy element of this YArray.
 *
 * @param {AbstractType} type
 * @param {function(any,number,AbstractType):void} f A function to execute on every element of this YArray.
 */
export const typeArrayForEach = (type, f) => {
  let index = 0
  let n = type._start
  while (n !== null) {
    if (n.countable && !n.deleted) {
      const c = n.getContent()
      for (let i = 0; i < c.length; i++) {
        f(c[i], index++, type)
      }
    }
    n = n.right
  }
}

/**
 * @param {AbstractType} type
 */
export const typeArrayCreateIterator = type => {
  let n = type._start
  /**
   * @type {Array<any>|null}
   */
  let currentContent = null
  let currentContentIndex = 0
  return {
    next: () => {
      // find some content
      if (currentContent === null) {
        while (n !== null && n.deleted) {
          n = n.right
        }
      }
      // check if we reached the end, no need to check currentContent, because it does not exist
      if (n === null) {
        return {
          done: true
        }
      }
      // currentContent could exist from the last iteration
      if (currentContent === null) {
        // we found n, so we can set currentContent
        currentContent = n.getContent()
        currentContentIndex = 0
      }
      const value = currentContent[currentContentIndex++]
      // check if we need to empty currentContent
      if (currentContent.length <= currentContentIndex) {
        currentContent = null
      }
      return {
        done: false,
        value
      }
    }
  }
}

/**
 * Executes a provided function on once on overy element of this YArray.
 * Operates on a snapshotted state of the document.
 *
 * @param {AbstractType} type
 * @param {function(any,number,AbstractType):void} f A function to execute on every element of this YArray.
 * @param {Snapshot} snapshot
 */
export const typeArrayForEachSnapshot = (type, f, snapshot) => {
  let index = 0
  let n = type._start
  while (n !== null) {
    if (n.countable && isVisible(n, snapshot)) {
      const c = n.getContent()
      for (let i = 0; i < c.length; i++) {
        f(c[i], index++, type)
      }
    }
    n = n.right
  }
}

/**
 * @param {AbstractType} type
 * @param {number} index
 * @return {any}
 */
export const typeArrayGet = (type, index) => {
  for (let n = type._start; n !== null; n = n.right) {
    if (!n.deleted && n.countable) {
      if (index < n.length) {
        return n.getContent()[index]
      }
      index -= n.length
    }
  }
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType} parent
 * @param {AbstractItem?} referenceItem
 * @param {Array<Object<string,any>|Array<any>|number|string|ArrayBuffer>} content
 */
export const typeArrayInsertGenericsAfter = (transaction, parent, referenceItem, content) => {
  let left = referenceItem
  const right = referenceItem === null ? parent._start : referenceItem.right
  /**
   * @type {Array<Object|Array|number>}
   */
  let jsonContent = []
  content.forEach(c => {
    switch (c.constructor) {
      case Object:
      case Array:
      case String:
        jsonContent.push(c)
        break
      default:
        if (jsonContent.length > 0) {
          const item = new ItemJSON(nextID(transaction), left, right, parent, null, jsonContent)
          item.integrate(transaction)
          jsonContent = []
        }
        switch (c.constructor) {
          case ArrayBuffer:
            // @ts-ignore c is definitely an ArrayBuffer
            new ItemBinary(nextID(transaction), left, right, parent, null, c).integrate(transaction)
            break
          default:
            if (c instanceof AbstractType) {
              new ItemType(nextID(transaction), left, right, parent, null, c).integrate(transaction)
            } else {
              throw new Error('Unexpected content type in insert operation')
            }
        }
    }
  })
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType} parent
 * @param {number} index
 * @param {Array<Object<string,any>|Array<any>|number|string|ArrayBuffer>} content
 */
export const typeArrayInsertGenerics = (transaction, parent, index, content) => {
  if (index === 0) {
    typeArrayInsertGenericsAfter(transaction, parent, null, content)
  }
  for (let n = parent._start; n !== null; n = n.right) {
    if (!n.deleted && n.countable) {
      if (index <= n.length) {
        if (index < n.length) {
          getItemCleanStart(transaction.y.store, transaction, createID(n.id.client, n.id.clock + index))
        }
        return typeArrayInsertGenericsAfter(transaction, parent, n, content)
      }
      index -= n.length
    }
  }
  throw new Error('Index exceeds array range')
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType} parent
 * @param {string} key
 */
export const typeMapDelete = (transaction, parent, key) => {
  const c = parent._map.get(key)
  if (c !== undefined) {
    c.delete(transaction)
  }
}
