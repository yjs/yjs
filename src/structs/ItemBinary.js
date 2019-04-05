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
  GC,
  ItemDeleted,
  Transaction, ID, AbstractType // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

export const structBinaryRefNumber = 1

export class ItemBinary extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @param {ArrayBuffer} content
   */
  constructor (id, left, right, parent, parentSub, content) {
    super(id, left, right, parent, parentSub)
    this.content = content
  }
  getContent () {
    return [this.content]
  }
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   */
  copy (id, left, right, parent, parentSub) {
    return new ItemBinary(id, left, right, parent, parentSub, this.content)
  }
  /**
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    super.write(encoder, offset, structBinaryRefNumber)
    encoding.writePayload(encoder, this.content)
  }
}

export class ItemBinaryRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {ID} id
   * @param {number} info
   */
  constructor (decoder, id, info) {
    super(decoder, id, info)
    /**
     * @type {ArrayBuffer}
     */
    this.content = decoding.readPayload(decoder)
  }
  /**
   * @param {Transaction} transaction
   * @param {number} offset
   * @return {ItemBinary|GC}
   */
  toStruct (transaction, offset) {
    const y = transaction.y
    const store = y.store

    let parent
    if (this.parent !== null) {
      const parentItem = getItemType(store, this.parent)
      switch (parentItem.constructor) {
        case ItemDeleted:
        case GC:
          return new GC(this.id, 1)
      }
      parent = parentItem.type
    } else {
      // @ts-ignore
      parent = y.get(this.parentYKey)
    }

    return new ItemBinary(
      this.id,
      this.left === null ? null : getItemCleanEnd(store, transaction, this.left),
      this.right === null ? null : getItemCleanStart(store, transaction, this.right),
      parent,
      this.parentSub,
      this.content
    )
  }
}
