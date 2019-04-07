/**
 * @module structs
 */

import {
  AbstractItem,
  AbstractItemRef,
  computeItemParams,
  GC,
  Y, StructStore, ID, AbstractType // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

export const structFormatRefNumber = 4

export class ItemFormat extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {ID | null} origin
   * @param {AbstractItem | null} right
   * @param {ID | null} rightOrigin
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @param {string} key
   * @param {any} value
   */
  constructor (id, left, origin, right, rightOrigin, parent, parentSub, key, value) {
    super(id, left, origin, right, rightOrigin, parent, parentSub)
    this.key = key
    this.value = value
  }
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {ID | null} origin
   * @param {AbstractItem | null} right
   * @param {ID | null} rightOrigin
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   */
  copy (id, left, origin, right, rightOrigin, parent, parentSub) {
    return new ItemFormat(id, left, origin, right, rightOrigin, parent, parentSub, this.key, this.value)
  }
  get countable () {
    return false
  }
  /**
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    super.write(encoder, offset, structFormatRefNumber)
    encoding.writeVarString(encoder, this.key)
    encoding.writeVarString(encoder, JSON.stringify(this.value))
  }
}

export class ItemFormatRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {ID} id
   * @param {number} info
   */
  constructor (decoder, id, info) {
    super(decoder, id, info)
    /**
     * @type {string}
     */
    this.key = decoding.readVarString(decoder)
    this.value = JSON.parse(decoding.readVarString(decoder))
  }
  /**
   * @param {Y} y
   * @param {StructStore} store
   * @param {number} offset
   * @return {ItemFormat|GC}
   */
  toStruct (y, store, offset) {
    const { left, right, parent, parentSub } = computeItemParams(y, store, this.left, this.right, this.parent, this.parentSub, this.parentYKey)
    return parent === null
      ? new GC(this.id, this.length)
      : new ItemFormat(
        this.id,
        left,
        this.left,
        right,
        this.right,
        parent,
        parentSub,
        this.key,
        this.value
      )
  }
}
