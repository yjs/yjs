/**
 * @module structs
 */

// TODO: ItemBinary should be able to merge with right (similar to other items). Or the other items (ItemJSON) should not be able to merge - extra byte + consistency

import { ID } from '../utils/ID.js' // eslint-disable-line
import { Y } from '../utils/Y.js' // eslint-disable-line
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line
import { AbstractType } from '../types/AbstractType.js' // eslint-disable-line
import { AbstractItem, logItemHelper, AbstractItemRef } from './AbstractItem.js'
import * as encoding from 'lib0/encoding.js' // eslint-disable-line
import * as decoding from 'lib0/decoding.js'
import { readYArray } from '../types/YArray.js'
import { readYMap } from '../types/YMap.js'
import { readYText } from '../types/YText.js'
import { readYXmlElement, readYXmlFragment } from '../types/YXmlElement.js'
import { readYXmlHook } from '../types/YXmlHook.js'
import { readYXmlText } from '../types/YXmlText.js'
import { getItemCleanEnd, getItemCleanStart, getItemType } from '../utils/StructStore.js'
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line


const gcChildren = (y, item) => {
  while (item !== null) {
    item._delete(y, false, true)
    item._gc(y)
    item = item._right
  }
}

export const structTypeRefNumber = 7

/**
 * @type {Array<function(decoding.Decoder):AbstractType>}
 */
export const typeRefs = [
  readYArray,
  readYMap,
  readYText,
  readYXmlElement,
  readYXmlFragment,
  readYXmlHook,
  readYXmlText
]

export class ItemType extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {ItemType | null} parent
   * @param {string | null} parentSub
   * @param {AbstractType} type
   */
  constructor (id, left, right, parent, parentSub, type) {
    super(id, left, right, parent, parentSub)
    this.type = type
  }
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {ItemType | null} parent
   * @param {string | null} parentSub
   * @return {AbstractItem} TODO, returns itemtype
   */
  copy (id, left, right, parent, parentSub) {
    return new ItemType(id, left, right, parent, parentSub, this.type._copy())
  }
  /**
   * Transform this Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  logString () {
    return logItemHelper('ItemType', this)
  }
  /**
   * @param {encoding.Encoder} encoder
   */
  write (encoder) {
    super.write(encoder, structTypeRefNumber)
    this.type._write(encoder)
  }
  /**
   * Mark this Item as deleted.
   *
   * @param {Transaction} transaction The Yjs instance
   * @param {boolean} createDelete Whether to propagate a message that this
   *                               Type was deleted.
   * @param {boolean} [gcChildren=(y._hasUndoManager===false)] Whether to garbage
   *                                         collect the children of this type.
   * @private
   */
  delete (transaction, createDelete, gcChildren = transaction.y.gcEnabled) {
    const y = transaction.y
    super.delete(transaction, createDelete, gcChildren)
    transaction.changed.delete(this)
    // delete map types
    for (let value of this.type._map.values()) {
      if (!value._deleted) {
        value._delete(y, false, gcChildren)
      }
    }
    // delete array types
    let t = this.type._start
    while (t !== null) {
      if (!t._deleted) {
        t._delete(y, false, gcChildren)
      }
      t = t._right
    }
    if (gcChildren) {
      this.gcChildren(y)
    }
  }

  /**
   * @param {Y} y
   */
  gcChildren (y) {
    gcChildren(y, this.type._start)
    this.type._start = null
    this.type._map.forEach(item => {
      gcChildren(y, item)
    })
    this._map = new Map()
  }

  /**
   * @param {Y} y
   */
  gc (y) {
    this.gcChildren(y)
    super.gc(y)
  }
}

export class ItemBinaryRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {number} info
   */
  constructor (decoder, info) {
    super(decoder, info)
    const typeRef = decoding.readVarUint(decoder)
    /**
     * @type {AbstractType}
     */
    this.type = typeRefs[typeRef](decoder)
  }
  /**
   * @param {Transaction} transaction
   * @return {ItemType}
   */
  toStruct (transaction) {
    const store = transaction.y.store
    return new ItemType(
      this.id,
      this.left === null ? null : getItemCleanEnd(store, transaction, this.left),
      this.right === null ? null : getItemCleanStart(store, transaction, this.right),
      this.parent === null ? null : getItemType(store, this.parent),
      this.parentSub,
      this.type
    )
  }
}
