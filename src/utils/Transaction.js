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
  AbstractType, AbstractItem, YEvent, ItemType, Y // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'

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
  }
  /**
   * @type {encoding.Encoder}
   */
  get updateMessage () {
    if (this._updateMessage === null) {
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
