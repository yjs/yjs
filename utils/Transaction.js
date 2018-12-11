/**
 * @module utils
 */

import * as encoding from '../lib/encoding.js'
import { Y } from '../utils/Y.js' // eslint-disable-line
import { Item } from '../structs/Item.js' // eslint-disable-line
import { Type } from '../structs/Type.js' // eslint-disable-line
import { YEvent } from './YEvent.js' // eslint-disable-line
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
  constructor (y) {
    /**
     * @type {Y} The Yjs instance.
     */
    this.y = y
    /**
     * All new types that are added during a transaction.
     * @type {Set<Item>}
     */
    this.newTypes = new Set()
    /**
     * All types that were directly modified (property added or child
     * inserted/deleted). New types are not included in this Set.
     * Maps from type to parentSubs (`item._parentSub = null` for YArray)
     * @type {Map<Type|Y,String>}
     */
    this.changedTypes = new Map()
    // TODO: rename deletedTypes
    /**
     * Set of all deleted Types and Structs.
     * @type {Set<Item>}
     */
    this.deletedStructs = new Set()
    /**
     * Saves the old state set of the Yjs instance. If a state was modified,
     * the original value is saved here.
     * @type {Map<Number,Number>}
     */
    this.beforeState = new Map()
    /**
     * Stores the events for the types that observe also child elements.
     * It is mainly used by `observeDeep`.
     * @type {Map<Type,Array<YEvent>>}
     */
    this.changedParentTypes = new Map()
    this.encodedStructsLen = 0
    this.encodedStructs = encoding.createEncoder()
  }
}
