/**
 * @module structs
 */

// TODO: ItemBinary should be able to merge with right (similar to other items). Or the other items (ItemJSON) should not be able to merge - extra byte + consistency

import {
  AbstractItem,
  AbstractItemRef,
  getItemCleanEnd,
  getItemCleanStart,
  getItemType,
  readYArray,
  readYMap,
  readYText,
  readYXmlElement,
  readYXmlFragment,
  readYXmlHook,
  readYXmlText,
  Y, GC, ItemDeleted, Transaction, ID, AbstractType // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js' // eslint-disable-line
import * as decoding from 'lib0/decoding.js'

/**
 * @param {Y} y
 * @param {AbstractItem | null} item
 */
const gcChildren = (y, item) => {
  while (item !== null) {
    item.gc(y)
    item = item.right
  }
}

export const structTypeRefNumber = 7

/**
 * @type {Array<function(decoding.Decoder):AbstractType<any>>}
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
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @param {AbstractType<any>} type
   */
  constructor (id, left, right, parent, parentSub, type) {
    super(id, left, right, parent, parentSub)
    this.type = type
  }
  getContent () {
    return [this.type]
  }
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @return {AbstractItem} TODO, returns itemtype
   */
  copy (id, left, right, parent, parentSub) {
    return new ItemType(id, left, right, parent, parentSub, this.type._copy())
  }
  /**
   * @param {Transaction} transaction
   */
  integrate (transaction) {
    this.type._integrate(transaction, this)
  }
  /**
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    super.write(encoder, offset, structTypeRefNumber)
    this.type._write(encoder)
  }
  /**
   * Mark this Item as deleted.
   *
   * @param {Transaction} transaction The Yjs instance
   * @private
   */
  delete (transaction) {
    const y = transaction.y
    super.delete(transaction)
    transaction.changed.delete(this.type)
    transaction.changedParentTypes.delete(this.type)
    // delete map types
    for (let value of this.type._map.values()) {
      if (!value.deleted) {
        value.delete(transaction)
      }
    }
    // delete array types
    let t = this.type._start
    while (t !== null) {
      if (!t.deleted) {
        t.delete(transaction)
      }
      t = t.right
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
   * @return {ItemDeleted|GC}
   */
  gc (y) {
    this.gcChildren(y)
    return super.gc(y)
  }
}

export class ItemTypeRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {ID} id
   * @param {number} info
   */
  constructor (decoder, id, info) {
    super(decoder, id, info)
    const typeRef = decoding.readVarUint(decoder)
    /**
     * @type {AbstractType<any>}
     */
    this.type = typeRefs[typeRef](decoder)
  }
  /**
   * @param {Transaction} transaction
   * @return {ItemType}
   */
  toStruct (transaction) {
    const y = transaction.y
    const store = y.store
    return new ItemType(
      this.id,
      this.left === null ? null : getItemCleanEnd(store, transaction, this.left),
      this.right === null ? null : getItemCleanStart(store, transaction, this.right),
      // @ts-ignore
      this.parent === null ? y.get(this.parentYKey) : getItemType(store, this.parent),
      this.parentSub,
      this.type
    )
  }
}
