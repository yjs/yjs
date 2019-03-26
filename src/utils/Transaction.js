/**
 * @module utils
 */

import * as encoding from 'lib0/encoding.js'
import { AbstractType } from '../types/AbstractType.js' // eslint-disable-line
import { AbstractItem } from '../structs/AbstractItem.js' // eslint-disable-line
import { Y } from './Y.js' // eslint-disable-line
import { YEvent } from './YEvent.js' // eslint-disable-line
import { ItemType } from '../structs/ItemType.js' // eslint-disable-line
import { getState } from './StructStore.js'
import { createID } from './ID.js' // eslint-disable-line

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
     * All new items that are added during a transaction.
     * @type {Set<AbstractItem>}
     */
    this.added = new Set()
    /**
     * Set of all deleted items
     * @type {Set<AbstractItem>}
     */
    this.deleted = new Set()
    /**
     * Saves the old state set of the Yjs instance. If a state was modified,
     * the original value is saved here.
     * @type {Map<Number,Number>}
     */
    this.beforeState = new Map()
    /**
     * All types that were directly modified (property added or child
     * inserted/deleted). New types are not included in this Set.
     * Maps from type to parentSubs (`item._parentSub = null` for YArray)
     * @type {Map<ItemType,Set<String|null>>}
     */
    this.changed = new Map()
    /**
     * Stores the events for the types that observe also child elements.
     * It is mainly used by `observeDeep`.
     * @type {Map<ItemType,Array<YEvent>>}
     */
    this.changedParentTypes = new Map()
    this.encodedStructsLen = 0
    this.encodedStructs = encoding.createEncoder()
  }
}

/**
 * @param {Transaction} transaction
 */
export const nextID = transaction => {
  const y = transaction.y
  return createID(y.clientID, getState(y.store, y.clientID))
}
