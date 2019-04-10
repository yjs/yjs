/**
 * @module utils
 */

import {
  getState,
  createID,
  writeStructsFromTransaction,
  writeDeleteSet,
  DeleteSet,
  sortAndMergeDeleteSet,
  getStates,
  findIndexSS,
  callEventHandlerListeners,
  AbstractItem,
  ItemDeleted,
  AbstractType, AbstractStruct, YEvent, Y // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as map from 'lib0/map.js'
import * as math from 'lib0/math.js'

/**
 * A transaction is created for every change on the Yjs model. It is possible
 * to bundle changes on the Yjs model in a single transaction to
 * minimize the number on messages sent and the number of observer calls.
 * If possible the user of this library should bundle as many changes as
 * possible. Here is an example to illustrate the advantages of bundling:
 *
 * @example
 * const map = y.define('map', YMap)
 * // Log content when change is triggered
 * map.observe(() => {
 *   console.log('change triggered')
 * })
 * // Each change on the map type triggers a log message:
 * map.set('a', 0) // => "change triggered"
 * map.set('b', 0) // => "change triggered"
 * // When put in a transaction, it will trigger the log after the transaction:
 * y.transact(() => {
 *   map.set('a', 1)
 *   map.set('b', 1)
 * }) // => "change triggered"
 *
 */
export class Transaction {
  /**
   * @param {Y} y
   */
  constructor (y) {
    /**
     * @type {Y} The Yjs instance.
     */
    this.y = y
    /**
     * Describes the set of deleted items by ids
     * @type {DeleteSet}
     */
    this.deleteSet = new DeleteSet()
    /**
     * Holds the state before the transaction started.
     * @type {Map<Number,Number>}
     */
    this.beforeState = getStates(y.store)
    /**
     * Holds the state after the transaction.
     * @type {Map<Number,Number>}
     */
    this.afterState = new Map()
    /**
     * All types that were directly modified (property added or child
     * inserted/deleted). New types are not included in this Set.
     * Maps from type to parentSubs (`item._parentSub = null` for YArray)
     * @type {Map<AbstractType<YEvent>,Set<String|null>>}
     */
    this.changed = new Map()
    /**
     * Stores the events for the types that observe also child elements.
     * It is mainly used by `observeDeep`.
     * @type {Map<AbstractType<YEvent>,Array<YEvent>>}
     */
    this.changedParentTypes = new Map()
    /**
     * @type {encoding.Encoder|null}
     */
    this._updateMessage = null
    /**
     * @type {Set<AbstractStruct>}
     */
    this._replacedItems = new Set()
  }
  /**
   * @type {encoding.Encoder|null}
   */
  get updateMessage () {
    // only create if content was added in transaction (state or ds changed)
    if (this._updateMessage === null && (this.deleteSet.clients.size > 0 || map.any(this.afterState, (clock, client) => this.beforeState.get(client) !== clock))) {
      const encoder = encoding.createEncoder()
      sortAndMergeDeleteSet(this.deleteSet)
      writeStructsFromTransaction(encoder, this)
      writeDeleteSet(encoder, this.deleteSet)
      this._updateMessage = encoder
    }
    return this._updateMessage
  }
}

/**
 * @param {Transaction} transaction
 */
export const nextID = transaction => {
  const y = transaction.y
  return createID(y.clientID, getState(y.store, y.clientID))
}

/**
 * Implements the functionality of `y.transact(()=>{..})`
 *
 * @param {Y} y
 * @param {function(Transaction):void} f
 */
export const transact = (y, f) => {
  let initialCall = false
  if (y._transaction === null) {
    initialCall = true
    y._transaction = new Transaction(y)
    y.emit('beforeTransaction', [y, y._transaction])
  }
  const transaction = y._transaction
  try {
    f(transaction)
  } finally {
    if (initialCall) {
      y._transaction = null
      y.emit('beforeObserverCalls', [y, y._transaction])
      // emit change events on changed types
      transaction.changed.forEach((subs, itemtype) => {
        itemtype._callObserver(transaction, subs)
      })
      transaction.changedParentTypes.forEach((events, type) => {
        events = events
          .filter(event =>
            event.target._item === null || !event.target._item.deleted
          )
        events
          .forEach(event => {
            event.currentTarget = type
          })
        // we don't need to check for events.length
        // because we know it has at least one element
        callEventHandlerListeners(type._dEH, [events, transaction])
      })
      // only call afterTransaction listeners if anything changed
      transaction.afterState = getStates(transaction.y.store)
      // when all changes & events are processed, emit afterTransaction event
      // transaction cleanup
      const store = transaction.y.store
      const ds = transaction.deleteSet
      // replace deleted items with ItemDeleted / GC
      sortAndMergeDeleteSet(ds)
      y.emit('afterTransaction', [y, transaction])
      for (const [client, deleteItems] of ds.clients) {
        /**
         * @type {Array<AbstractStruct>}
         */
        // @ts-ignore
        const structs = store.clients.get(client)
        for (let di = 0; di < deleteItems.length; di++) {
          const deleteItem = deleteItems[di]
          for (let si = findIndexSS(structs, deleteItem.clock); si < structs.length; si++) {
            const struct = structs[si]
            if (deleteItem.clock + deleteItem.len <= struct.id.clock) {
              break
            }
            if (struct.deleted && struct instanceof AbstractItem && (struct.constructor !== ItemDeleted || (struct.parent._item !== null && struct.parent._item.deleted))) {
              // check if we can GC
              struct.gc(transaction, store)
            }
          }
        }
      }
      /**
       * @param {Array<AbstractStruct>} structs
       * @param {number} pos
       */
      const tryToMergeWithLeft = (structs, pos) => {
        const left = structs[pos - 1]
        const right = structs[pos]
        if (left.deleted === right.deleted && left.constructor === right.constructor) {
          if (left.mergeWith(right)) {
            structs.splice(pos, 1)
            if (right instanceof AbstractItem && right.parentSub !== null && right.parent._map.get(right.parentSub) === right) {
              // @ts-ignore we already did a constructor check above
              right.parent._map.set(right.parentSub, left)
            }
          }
        }
      }
      // on all affected store.clients props, try to merge
      for (const [client, clock] of transaction.afterState) {
        const beforeClock = transaction.beforeState.get(client) || 0
        if (beforeClock !== clock) {
          /**
           * @type {Array<AbstractStruct>}
           */
          // @ts-ignore
          const structs = store.clients.get(client)
          // we iterate from right to left so we can safely remove entries
          const firstChangePos = math.max(findIndexSS(structs, beforeClock), 1)
          for (let i = structs.length - 1; i >= firstChangePos; i--) {
            tryToMergeWithLeft(structs, i)
          }
        }
      }
      // try to merge replacedItems
      // TODO: replacedItems should hold ids
      for (const replacedItem of transaction._replacedItems) {
        const id = replacedItem.id
        const client = id.client
        const clock = id.clock
        /**
         * @type {Array<AbstractStruct>}
         */
        // @ts-ignore
        const structs = store.clients.get(client)
        const replacedStructPos = findIndexSS(structs, clock)
        if (replacedStructPos + 1 < structs.length) {
          tryToMergeWithLeft(structs, replacedStructPos + 1)
        }
        if (replacedStructPos > 0) {
          tryToMergeWithLeft(structs, replacedStructPos)
        }
      }
      y.emit('afterTransactionCleanup', [y, transaction])
    }
  }
}
