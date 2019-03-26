/**
 * @module structs
 */

// TODO: ItemBinary should be able to merge with right (similar to other items). Or the other items (ItemJSON) should not be able to merge - extra byte + consistency

import { AbstractItem, logItemHelper, AbstractItemRef } from './AbstractItem.js'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import { ID } from '../utils/ID.js' // eslint-disable-line
import { ItemType } from './ItemType.js' // eslint-disable-line
import { Y } from '../utils/Y.js' // eslint-disable-line

export const structDeletedRefNumber = 2

export class ItemBinary extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {ItemType | null} parent
   * @param {string | null} parentSub
   * @param {ArrayBuffer} content
   */
  constructor (id, left, right, parent, parentSub, content) {
    super(id, left, right, parent, parentSub)
    this.content = content
  }
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {AbstractItem | null} right
   * @param {ItemType | null} parent
   * @param {string | null} parentSub
   */
  copy (id, left, right, parent, parentSub) {
    return new ItemBinary(id, left, right, parent, parentSub, this.content)
  }
  /**
   * Transform this Type to a readable format.
   * Useful for logging as all Items and Delete implement this method.
   *
   * @private
   */
  logString () {
    return logItemHelper('ItemBinary', this)
  }
  /**
   * @param {encoding.Encoder} encoder
   */
  write (encoder) {
    super.write(encoder, structDeletedRefNumber)
    encoding.writePayload(encoder, this.content)
  }
}

export class ItemDeletedRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {number} info
   */
  constructor (decoder, info) {
    super(decoder, info)
    /**
     * @type {ArrayBuffer}
     */
    this.content = decoding.readPayload(decoder)
  }
  /**
   * @param {Y} y
   * @return {ItemBinary}
   */
  toStruct (y) {
    return new ItemBinary(
      this.id,
      this.left === null ? null : y.os.getItemCleanEnd(this.left),
      this.right === null ? null : y.os.getItemCleanStart(this.right),
      this.parent === null ? null : y.os.getItem(this.parent),
      this.parentSub,
      this.content
    )
  }
}
