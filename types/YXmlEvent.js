/**
 * @module types
 */

import { YEvent } from '../utils/YEvent.js'

import { Type } from '../structs/Type.js' // eslint-disable-line
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line

/**
 * An Event that describes changes on a YXml Element or Yxml Fragment
 *
 * @protected
 */
export class YXmlEvent extends YEvent {
  /**
   * @param {Type} target The target on which the event is created.
   * @param {Set} subs The set of changed attributes. `null` is included if the
   *                   child list changed.
   * @param {Boolean} remote Whether this change was created by a remote peer.
   * @param {Transaction} transaction The transaction instance with wich the
   *                                  change was created.
   */
  constructor (target, subs, remote, transaction) {
    super(target)
    /**
     * The transaction instance for the computed change.
     * @type {Transaction}
     */
    this._transaction = transaction
    /**
     * Whether the children changed.
     * @type {Boolean}
     */
    this.childListChanged = false
    /**
     * Set of all changed attributes.
     * @type {Set}
     */
    this.attributesChanged = new Set()
    /**
     * Whether this change was created by a remote peer.
     * @type {Boolean}
     */
    this.remote = remote
    subs.forEach((sub) => {
      if (sub === null) {
        this.childListChanged = true
      } else {
        this.attributesChanged.add(sub)
      }
    })
  }
}
