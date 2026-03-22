import { addToIdSet } from '../utils/IdSet.js'

export class ContentDeleted {
  /**
   * @param {number} len
   */
  constructor (len) {
    this.len = len
  }

  /**
   * @return {number}
   */
  getLength () {
    return this.len
  }

  /**
   * @return {Array<any>}
   */
  getContent () {
    return []
  }

  /**
   * @return {boolean}
   */
  isCountable () {
    return false
  }

  /**
   * @return {ContentDeleted}
   */
  copy () {
    return new ContentDeleted(this.len)
  }

  /**
   * @param {number} offset
   * @return {ContentDeleted}
   */
  splice (offset) {
    const right = new ContentDeleted(this.len - offset)
    this.len = offset
    return right
  }

  /**
   * @param {ContentDeleted} right
   * @return {boolean}
   */
  mergeWith (right) {
    this.len += right.len
    return true
  }

  /**
   * @param {import('../utils/Transaction.js').Transaction} transaction
   * @param {import('../structs/Item.js').Item} item
   */
  integrate (transaction, item) {
    addToIdSet(transaction.deleteSet, item.id.client, item.id.clock, this.len)
    item.markDeleted()
  }

  /**
   * @param {import('../utils/Transaction.js').Transaction} _transaction
   */
  delete (_transaction) {}
  /**
   * @param {import('../utils/Transaction.js').Transaction} _tr
   */
  gc (_tr) {}
  /**
   * @param {import('../utils/UpdateEncoder.js').UpdateEncoderV1 | import('../utils/UpdateEncoder.js').UpdateEncoderV2} encoder
   * @param {number} offset
   * @param {number} offsetEnd
   */
  write (encoder, offset, offsetEnd) {
    encoder.writeLen(this.len - offset - offsetEnd)
  }

  /**
   * @return {number}
   */
  getRef () {
    return 1
  }
}

/**
 * @private
 *
 * @param {import('../utils/UpdateDecoder.js').UpdateDecoderV1 | import('../utils/UpdateDecoder.js').UpdateDecoderV2} decoder
 * @return {ContentDeleted}
 */
export const readContentDeleted = decoder => new ContentDeleted(decoder.readLen())
