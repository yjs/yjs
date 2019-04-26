
import {
  removeEventHandlerListener,
  callEventHandlerListeners,
  addEventHandlerListener,
  createEventHandler,
  ItemType,
  nextID,
  isVisible,
  ItemJSON,
  ItemBinary,
  createID,
  getItemCleanStart,
  Y, Snapshot, Transaction, EventHandler, YEvent, AbstractItem, // eslint-disable-line
} from '../internals.js'

import * as map from 'lib0/map.js'
import * as iterator from 'lib0/iterator.js'
import * as error from 'lib0/error.js'
import * as encoding from 'lib0/encoding.js' // eslint-disable-line

/**
 * Call event listeners with an event. This will also add an event to all
 * parents (for `.observeDeep` handlers).
 * @private
 *
 * @template EventType
 * @param {AbstractType<EventType>} type
 * @param {Transaction} transaction
 * @param {EventType} event
 */
export const callTypeObservers = (type, transaction, event) => {
  callEventHandlerListeners(type._eH, event, transaction)
  const changedParentTypes = transaction.changedParentTypes
  while (true) {
    // @ts-ignore
    map.setIfUndefined(changedParentTypes, type, () => []).push(event)
    if (type._item === null) {
      break
    }
    type = type._item.parent
  }
}

/**
 * @template EventType
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
    /**
     * Event handlers
     * @type {EventHandler<EventType,Transaction>}
     */
    this._eH = createEventHandler()
    /**
     * Deep event handlers
     * @type {EventHandler<Array<YEvent>,Transaction>}
     */
    this._dEH = createEventHandler()
  }

  /**
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Y} y The Yjs instance
   * @param {ItemType|null} item
   * @private
   */
  _integrate (y, item) {
    this._y = y
    this._item = item
  }

  /**
   * @return {AbstractType<EventType>}
   * @private
   */
  _copy () {
    throw new Error('unimplemented')
  }

  /**
   * @param {encoding.Encoder} encoder
   * @private
   */
  _write (encoder) { }

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
   * Creates YEvent and calls all type observers.
   * Must be implemented by each type.
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
   *
   * @private
   */
  _callObserver (transaction, parentSubs) { /* skip if no type is specified */ }

  /**
   * Observe all events that are created on this type.
   *
   * @param {function(EventType, Transaction):void} f Observer function
   */
  observe (f) {
    addEventHandlerListener(this._eH, f)
  }

  /**
   * Observe all events that are created by this type and its children.
   *
   * @param {function(Array<YEvent>,Transaction):void} f Observer function
   */
  observeDeep (f) {
    addEventHandlerListener(this._dEH, f)
  }

  /**
   * Unregister an observer function.
   *
   * @param {function(EventType,Transaction):void} f Observer function
   */
  unobserve (f) {
    removeEventHandlerListener(this._eH, f)
  }

  /**
   * Unregister an observer function.
   *
   * @param {function(Array<YEvent>,Transaction):void} f Observer function
   */
  unobserveDeep (f) {
    removeEventHandlerListener(this._dEH, f)
  }

  /**
   * @abstract
   * @return {Object | Array | number | string}
   */
  toJSON () {}
}

/**
 * @param {AbstractType<any>} type
 * @return {Array<any>}
 *
 * @private
 * @function
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
 * @param {AbstractType<any>} type
 * @param {Snapshot} snapshot
 * @return {Array<any>}
 *
 * @private
 * @function
 */
export const typeArrayToArraySnapshot = (type, snapshot) => {
  const cs = []
  let n = type._start
  while (n !== null) {
    if (n.countable && isVisible(n, snapshot)) {
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
 * @param {AbstractType<any>} type
 * @param {function(any,number,AbstractType<any>):void} f A function to execute on every element of this YArray.
 *
 * @private
 * @function
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
 * @template C,R
 * @param {AbstractType<any>} type
 * @param {function(C,number,AbstractType<any>):R} f
 * @return {Array<R>}
 *
 * @private
 * @function
 */
export const typeArrayMap = (type, f) => {
  /**
   * @type {Array<any>}
   */
  const result = []
  typeArrayForEach(type, (c, i) => {
    result.push(f(c, i, type))
  })
  return result
}

/**
 * @param {AbstractType<any>} type
 * @return {IterableIterator<any>}
 *
 * @private
 * @function
 */
export const typeArrayCreateIterator = type => {
  let n = type._start
  /**
   * @type {Array<any>|null}
   */
  let currentContent = null
  let currentContentIndex = 0
  return {
    [Symbol.iterator] () {
      return this
    },
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
          done: true,
          value: undefined
        }
      }
      // currentContent could exist from the last iteration
      if (currentContent === null) {
        // we found n, so we can set currentContent
        currentContent = n.getContent()
        currentContentIndex = 0
        n = n.right // we used the content of n, now iterate to next
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
 * @param {AbstractType<any>} type
 * @param {function(any,number,AbstractType<any>):void} f A function to execute on every element of this YArray.
 * @param {Snapshot} snapshot
 *
 * @private
 * @function
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
 * @param {AbstractType<any>} type
 * @param {number} index
 * @return {any}
 *
 * @private
 * @function
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
 * @param {AbstractType<any>} parent
 * @param {AbstractItem?} referenceItem
 * @param {Array<Object<string,any>|Array<any>|number|string|ArrayBuffer>} content
 *
 * @private
 * @function
 */
export const typeArrayInsertGenericsAfter = (transaction, parent, referenceItem, content) => {
  let left = referenceItem
  const right = referenceItem === null ? parent._start : referenceItem.right
  /**
   * @type {Array<Object|Array|number>}
   */
  let jsonContent = []
  const packJsonContent = () => {
    if (jsonContent.length > 0) {
      left = new ItemJSON(nextID(transaction), left, left === null ? null : left.lastId, right, right === null ? null : right.id, parent, null, jsonContent)
      left.integrate(transaction)
      jsonContent = []
    }
  }
  content.forEach(c => {
    switch (c.constructor) {
      case Number:
      case Object:
      case Array:
      case String:
        jsonContent.push(c)
        break
      default:
        packJsonContent()
        switch (c.constructor) {
          case ArrayBuffer:
            // @ts-ignore c is definitely an ArrayBuffer
            left = new ItemBinary(nextID(transaction), left, left === null ? null : left.lastId, right, right === null ? null : right.id, parent, null, c)
            // @ts-ignore
            left.integrate(transaction)
            break
          default:
            if (c instanceof AbstractType) {
              left = new ItemType(nextID(transaction), left, left === null ? null : left.lastId, right, right === null ? null : right.id, parent, null, c)
              left.integrate(transaction)
            } else {
              throw new Error('Unexpected content type in insert operation')
            }
        }
    }
  })
  packJsonContent()
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {number} index
 * @param {Array<Object<string,any>|Array<any>|number|string|ArrayBuffer>} content
 *
 * @private
 * @function
 */
export const typeArrayInsertGenerics = (transaction, parent, index, content) => {
  if (index === 0) {
    return typeArrayInsertGenericsAfter(transaction, parent, null, content)
  }
  let n = parent._start
  for (; n !== null; n = n.right) {
    if (!n.deleted && n.countable) {
      if (index <= n.length) {
        if (index < n.length) {
          // insert in-between
          getItemCleanStart(transaction, transaction.y.store, createID(n.id.client, n.id.clock + index))
        }
        break
      }
      index -= n.length
    }
  }
  return typeArrayInsertGenericsAfter(transaction, parent, n, content)
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {number} index
 * @param {number} length
 *
 * @private
 * @function
 */
export const typeArrayDelete = (transaction, parent, index, length) => {
  if (length === 0) { return }
  let n = parent._start
  // compute the first item to be deleted
  for (; n !== null && index > 0; n = n.right) {
    if (!n.deleted && n.countable) {
      if (index < n.length) {
        getItemCleanStart(transaction, transaction.y.store, createID(n.id.client, n.id.clock + index))
      }
      index -= n.length
    }
  }
  // delete all items until done
  while (length > 0 && n !== null) {
    if (!n.deleted) {
      if (length < n.length) {
        getItemCleanStart(transaction, transaction.y.store, createID(n.id.client, n.id.clock + length))
      }
      n.delete(transaction)
      length -= n.length
    }
    n = n.right
  }
  if (length > 0) {
    throw error.create('array length exceeded')
  }
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {string} key
 *
 * @private
 * @function
 */
export const typeMapDelete = (transaction, parent, key) => {
  const c = parent._map.get(key)
  if (c !== undefined) {
    c.delete(transaction)
  }
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {string} key
 * @param {Object|number|Array<any>|string|ArrayBuffer|AbstractType<any>} value
 *
 * @private
 * @function
 */
export const typeMapSet = (transaction, parent, key, value) => {
  const left = parent._map.get(key) || null
  if (value == null) {
    new ItemJSON(nextID(transaction), left, left === null ? null : left.lastId, null, null, parent, key, [value]).integrate(transaction)
    return
  }
  switch (value.constructor) {
    case Number:
    case Object:
    case Array:
    case String:
      new ItemJSON(nextID(transaction), left, left === null ? null : left.lastId, null, null, parent, key, [value]).integrate(transaction)
      break
    case ArrayBuffer:
      new ItemBinary(nextID(transaction), left, left === null ? null : left.lastId, null, null, parent, key, value).integrate(transaction)
      break
    default:
      if (value instanceof AbstractType) {
        new ItemType(nextID(transaction), left, left === null ? null : left.lastId, null, null, parent, key, value).integrate(transaction)
      } else {
        throw new Error('Unexpected content type')
      }
  }
}

/**
 * @param {AbstractType<any>} parent
 * @param {string} key
 * @return {Object<string,any>|number|Array<any>|string|ArrayBuffer|AbstractType<any>|undefined}
 *
 * @private
 * @function
 */
export const typeMapGet = (parent, key) => {
  const val = parent._map.get(key)
  return val !== undefined && !val.deleted ? val.getContent()[0] : undefined
}

/**
 * @param {AbstractType<any>} parent
 * @return {Object<string,Object<string,any>|number|Array<any>|string|ArrayBuffer|AbstractType<any>|undefined>}
 *
 * @private
 * @function
 */
export const typeMapGetAll = (parent) => {
  /**
   * @type {Object<string,any>}
   */
  let res = {}
  for (const [key, value] of parent._map) {
    if (!value.deleted) {
      res[key] = value.getContent()[value.length - 1]
    }
  }
  return res
}

/**
 * @param {AbstractType<any>} parent
 * @param {string} key
 * @return {boolean}
 *
 * @private
 * @function
 */
export const typeMapHas = (parent, key) => {
  const val = parent._map.get(key)
  return val !== undefined && !val.deleted
}

/**
 * @param {AbstractType<any>} parent
 * @param {string} key
 * @param {Snapshot} snapshot
 * @return {Object<string,any>|number|Array<any>|string|ArrayBuffer|AbstractType<any>|undefined}
 *
 * @private
 * @function
 */
export const typeMapGetSnapshot = (parent, key, snapshot) => {
  let v = parent._map.get(key) || null
  while (v !== null && (!snapshot.sm.has(v.id.client) || v.id.clock >= (snapshot.sm.get(v.id.client) || 0))) {
    v = v.left
  }
  return v !== null && isVisible(v, snapshot) ? v.getContent()[v.length - 1] : undefined
}

/**
 * @param {Map<string,AbstractItem>} map
 * @return {IterableIterator<Array<any>>}
 *
 * @private
 * @function
 */
export const createMapIterator = map => iterator.iteratorFilter(map.entries(), entry => !entry[1].deleted)
