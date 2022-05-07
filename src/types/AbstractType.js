
import {
  removeEventHandlerListener,
  callEventHandlerListeners,
  addEventHandlerListener,
  createEventHandler,
  getState,
  isVisible,
  ContentType,
  createID,
  ContentAny,
  ContentBinary,
  ListIterator,
  ContentDoc, YText, YArray, UpdateEncoderV1, UpdateEncoderV2, Doc, Snapshot, Transaction, EventHandler, YEvent, Item, // eslint-disable-line
} from '../internals.js'

import * as map from 'lib0/map'
import * as iterator from 'lib0/iterator'
import * as error from 'lib0/error'
import * as math from 'lib0/math'

const maxSearchMarker = 80

/**
 * Search marker help us to find positions in the associative array faster.
 *
 * They speed up the process of finding a position without much bookkeeping.
 *
 * A maximum of `maxSearchMarker` objects are created.
 *
 * @template T
 * @param {Transaction} tr
 * @param {AbstractType<any>} yarray
 * @param {number} index
 * @param {function(ListIterator):T} f
 * @return T
 */
export const useSearchMarker = (tr, yarray, index, f) => {
  const searchMarker = yarray._searchMarker
  if (searchMarker === null || yarray._start === null) { // @todo add condition `index < 5`
    return f(new ListIterator(yarray).forward(tr, index, true))
  }
  if (searchMarker.length === 0) {
    const sm = new ListIterator(yarray).forward(tr, index, true)
    searchMarker.push(sm)
    if (sm.nextItem) sm.nextItem.marker = true
  }
  const sm = searchMarker.reduce(
    (a, b, arrayIndex) => math.abs(index - a.index) < math.abs(index - b.index) ? a : b
  )
  const newIsCheaper = math.abs(sm.index - index) > index // @todo use >= index
  const createFreshMarker = searchMarker.length < maxSearchMarker && (math.abs(sm.index - index) > 5 || newIsCheaper)
  const fsm = createFreshMarker ? (newIsCheaper ? new ListIterator(yarray) : sm.clone()) : sm
  const prevItem = /** @type {Item} */ (sm.nextItem)
  if (createFreshMarker) {
    searchMarker.push(fsm)
  }
  const diff = fsm.index - index
  if (diff > 0) {
    fsm.backward(tr, diff)
  } else {
    fsm.forward(tr, -diff, true)
  }
  // @todo remove this test
  /*
  const otherTesting = new ListIterator(yarray)
  otherTesting.forward(tr, index)
  if (otherTesting.nextItem !== fsm.nextItem || otherTesting.index !== fsm.index || otherTesting.reachedEnd !== fsm.reachedEnd) {
    throw new Error('udtirane')
  }
  */
  const result = f(fsm)
  if (fsm.reachedEnd) {
    fsm.reachedEnd = false
    const nextItem = /** @type {Item} */ (fsm.nextItem)
    if (nextItem.countable && !nextItem.deleted) {
      fsm.index -= nextItem.length
    }
    fsm.rel = 0
  }
  fsm.index -= fsm.rel
  fsm.rel = 0
  if (!createFreshMarker) {
    // reused old marker and we moved to a different position
    prevItem.marker = false
  }
  const fsmItem = fsm.nextItem
  if (fsmItem) {
    if (fsmItem.marker) {
      // already marked, forget current iterator
      searchMarker.splice(searchMarker.findIndex(m => m === fsm), 1)
    } else {
      fsmItem.marker = true
    }
  }
  return result
}

/**
 * Update markers when a change happened.
 *
 * This should be called before doing a deletion!
 *
 * @param {Array<ListIterator>} searchMarker
 * @param {number} index
 * @param {number} len If insertion, len is positive. If deletion, len is negative.
 * @param {ListIterator|null} origSearchMarker Do not update this searchmarker because it is the one we used to manipulate. @todo !=null for improved perf in ytext
 */
export const updateMarkerChanges = (searchMarker, index, len, origSearchMarker) => {
  for (let i = searchMarker.length - 1; i >= 0; i--) {
    const marker = searchMarker[i]
    if (marker !== origSearchMarker) {
      if (len > 0 && index === marker.index) {
        // inserting at a marked position deletes the marked position because we can't do a simple transformation
        // (we don't know whether to insert directly before or directly after the position)
        searchMarker.splice(i, 1)
        if (marker.nextItem) marker.nextItem.marker = false
        continue
      }
      if (index < marker.index) { // a simple index <= m.index check would actually suffice
        marker.index = math.max(index, marker.index + len)
      }
    }
  }
}

/**
 * Accumulate all (list) children of a type and return them as an Array.
 *
 * @param {AbstractType<any>} t
 * @return {Array<Item>}
 */
export const getTypeChildren = t => {
  let s = t._start
  const arr = []
  while (s) {
    arr.push(s)
    s = s.right
  }
  return arr
}

/**
 * Call event listeners with an event. This will also add an event to all
 * parents (for `.observeDeep` handlers).
 *
 * @template EventType
 * @param {AbstractType<EventType>} type
 * @param {Transaction} transaction
 * @param {EventType} event
 */
export const callTypeObservers = (type, transaction, event) => {
  const changedType = type
  const changedParentTypes = transaction.changedParentTypes
  while (true) {
    // @ts-ignore
    map.setIfUndefined(changedParentTypes, type, () => []).push(event)
    if (type._item === null) {
      break
    }
    type = /** @type {AbstractType<any>} */ (type._item.parent)
  }
  callEventHandlerListeners(changedType._eH, event, transaction)
}

/**
 * @template EventType
 * Abstract Yjs Type class
 */
export class AbstractType {
  constructor () {
    /**
     * @type {Item|null}
     */
    this._item = null
    /**
     * @type {Map<string,Item>}
     */
    this._map = new Map()
    /**
     * @type {Item|null}
     */
    this._start = null
    /**
     * @type {Doc|null}
     */
    this.doc = null
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
    /**
     * @type {null | Array<ListIterator>}
     */
    this._searchMarker = null
    /**
     * You can store custom stuff here.
     * This might be useful to associate your application state to this shared type.
     *
     * @type {Map<any, any>}
     */
    this.meta = new Map()
  }

  /**
   * @return {AbstractType<any>|null}
   */
  get parent () {
    return this._item ? /** @type {AbstractType<any>} */ (this._item.parent) : null
  }

  /**
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Doc} y The Yjs instance
   * @param {Item|null} item
   */
  _integrate (y, item) {
    this.doc = y
    this._item = item
  }

  /**
   * @return {AbstractType<EventType>}
   */
  _copy () {
    throw error.methodUnimplemented()
  }

  /**
   * @return {AbstractType<EventType>}
   */
  clone () {
    throw error.methodUnimplemented()
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
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
   */
  _callObserver (transaction, parentSubs) {
    if (!transaction.local && this._searchMarker) {
      this._searchMarker.length = 0
    }
  }

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
   * @return {any}
   */
  toJSON () {}
}

/**
 * @param {AbstractType<any>} type
 * @param {number} start
 * @param {number} end
 * @return {Array<any>}
 *
 * @private
 * @function
 */
export const typeListSlice = (type, start, end) => {
  if (start < 0) {
    start = type._length + start
  }
  if (end < 0) {
    end = type._length + end
  }
  let len = end - start
  const cs = []
  let n = type._start
  while (n !== null && len > 0) {
    if (n.countable && !n.deleted) {
      const c = n.content.getContent()
      if (c.length <= start) {
        start -= c.length
      } else {
        for (let i = start; i < c.length && len > 0; i++) {
          cs.push(c[i])
          len--
        }
        start = 0
      }
    }
    n = n.right
  }
  return cs
}

/**
 * @param {AbstractType<any>} type
 * @return {Array<any>}
 *
 * @private
 * @function
 */
export const typeListToArray = type => {
  const cs = []
  let n = type._start
  while (n !== null) {
    if (n.countable && !n.deleted) {
      const c = n.content.getContent()
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
export const typeListToArraySnapshot = (type, snapshot) => {
  const cs = []
  let n = type._start
  while (n !== null) {
    if (n.countable && isVisible(n, snapshot)) {
      const c = n.content.getContent()
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
 * @param {function(any,number,any):void} f A function to execute on every element of this YArray.
 *
 * @private
 * @function
 */
export const typeListForEach = (type, f) => {
  let index = 0
  let n = type._start
  while (n !== null) {
    if (n.countable && !n.deleted) {
      const c = n.content.getContent()
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
export const typeListMap = (type, f) => {
  /**
   * @type {Array<any>}
   */
  const result = []
  typeListForEach(type, (c, i) => {
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
export const typeListCreateIterator = type => {
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
        // check if we reached the end, no need to check currentContent, because it does not exist
        if (n === null) {
          return {
            done: true,
            value: undefined
          }
        }
        // we found n, so we can set currentContent
        currentContent = n.content.getContent()
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
export const typeListForEachSnapshot = (type, f, snapshot) => {
  let index = 0
  let n = type._start
  while (n !== null) {
    if (n.countable && isVisible(n, snapshot)) {
      const c = n.content.getContent()
      for (let i = 0; i < c.length; i++) {
        f(c[i], index++, type)
      }
    }
    n = n.right
  }
}

/**
 * @param {Transaction} transaction
 * @param {AbstractType<any>} parent
 * @param {Item?} referenceItem
 * @param {Array<Object<string,any>|Array<any>|boolean|number|null|string|Uint8Array>} content
 *
 * @private
 * @function
 */
export const typeListInsertGenericsAfter = (transaction, parent, referenceItem, content) => {
  let left = referenceItem
  const doc = transaction.doc
  const ownClientId = doc.clientID
  const store = doc.store
  const right = referenceItem === null ? parent._start : referenceItem.right
  /**
   * @type {Array<Object|Array<any>|number|null>}
   */
  let jsonContent = []
  const packJsonContent = () => {
    if (jsonContent.length > 0) {
      left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentAny(jsonContent))
      left.integrate(transaction, 0)
      jsonContent = []
    }
  }
  content.forEach(c => {
    if (c === null) {
      jsonContent.push(c)
    } else {
      switch (c.constructor) {
        case Number:
        case Object:
        case Boolean:
        case Array:
        case String:
          jsonContent.push(c)
          break
        default:
          packJsonContent()
          switch (c.constructor) {
            case Uint8Array:
            case ArrayBuffer:
              left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentBinary(new Uint8Array(/** @type {Uint8Array} */ (c))))
              left.integrate(transaction, 0)
              break
            case Doc:
              left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentDoc(/** @type {Doc} */ (c)))
              left.integrate(transaction, 0)
              break
            default:
              if (c instanceof AbstractType) {
                left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, new ContentType(c))
                left.integrate(transaction, 0)
              } else {
                throw new Error('Unexpected content type in insert operation')
              }
          }
      }
    }
  })
  packJsonContent()
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
 * @param {Object|number|null|Array<any>|string|Uint8Array|AbstractType<any>} value
 *
 * @private
 * @function
 */
export const typeMapSet = (transaction, parent, key, value) => {
  const left = parent._map.get(key) || null
  const doc = transaction.doc
  const ownClientId = doc.clientID
  let content
  if (value == null) {
    content = new ContentAny([value])
  } else {
    switch (value.constructor) {
      case Number:
      case Object:
      case Boolean:
      case Array:
      case String:
        content = new ContentAny([value])
        break
      case Uint8Array:
        content = new ContentBinary(/** @type {Uint8Array} */ (value))
        break
      case Doc:
        content = new ContentDoc(/** @type {Doc} */ (value))
        break
      default:
        if (value instanceof AbstractType) {
          content = new ContentType(value)
        } else {
          throw new Error('Unexpected content type')
        }
    }
  }
  new Item(createID(ownClientId, getState(doc.store, ownClientId)), left, left && left.lastId, null, null, parent, key, content).integrate(transaction, 0)
}

/**
 * @param {AbstractType<any>} parent
 * @param {string} key
 * @return {Object<string,any>|number|null|Array<any>|string|Uint8Array|AbstractType<any>|undefined}
 *
 * @private
 * @function
 */
export const typeMapGet = (parent, key) => {
  const val = parent._map.get(key)
  return val !== undefined && !val.deleted ? val.content.getContent()[val.length - 1] : undefined
}

/**
 * @param {AbstractType<any>} parent
 * @return {Object<string,Object<string,any>|number|null|Array<any>|string|Uint8Array|AbstractType<any>|undefined>}
 *
 * @private
 * @function
 */
export const typeMapGetAll = (parent) => {
  /**
   * @type {Object<string,any>}
   */
  const res = {}
  parent._map.forEach((value, key) => {
    if (!value.deleted) {
      res[key] = value.content.getContent()[value.length - 1]
    }
  })
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
 * @return {Object<string,any>|number|null|Array<any>|string|Uint8Array|AbstractType<any>|undefined}
 *
 * @private
 * @function
 */
export const typeMapGetSnapshot = (parent, key, snapshot) => {
  let v = parent._map.get(key) || null
  while (v !== null && (!snapshot.sv.has(v.id.client) || v.id.clock >= (snapshot.sv.get(v.id.client) || 0))) {
    v = v.left
  }
  return v !== null && isVisible(v, snapshot) ? v.content.getContent()[v.length - 1] : undefined
}

/**
 * @param {Map<string,Item>} map
 * @return {IterableIterator<Array<any>>}
 *
 * @private
 * @function
 */
export const createMapIterator = map => iterator.iteratorFilter(map.entries(), /** @param {any} entry */ entry => !entry[1].deleted)
