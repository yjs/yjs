/**
 * @module types
 */

import { YEvent } from '../utils/YEvent.js'

import { AbstractType } from './AbstractType.js' // eslint-disable-line
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line
import { YXmlElement, YXmlFragment } from './YXmlElement.js' // eslint-disable-line

/**
 * An Event that describes changes on a YXml Element or Yxml Fragment
 *
 * @protected
 */
export class YXmlEvent extends YEvent {
  /**
   * @param {YXmlElement|YXmlFragment} target The target on which the event is created.
   * @param {Set<string|null>} subs The set of changed attributes. `null` is included if the
   *                   child list changed.
   * @param {Transaction} transaction The transaction instance with wich the
   *                                  change was created.
   */
  constructor (target, subs, transaction) {
    super(target, transaction)
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
     * @type {Set<string|null>}
     */
    this.attributesChanged = new Set()
    subs.forEach((sub) => {
      if (sub === null) {
        this.childListChanged = true
      } else {
        this.attributesChanged.add(sub)
      }
    })
  }
}
