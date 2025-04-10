import {
  AbstractStruct,
  addStruct,
  addStructToIdSet,
  addToIdSet,
  UpdateEncoderV1, UpdateEncoderV2, StructStore, Transaction // eslint-disable-line
} from '../internals.js'

export const structGCRefNumber = 0

/**
 * @private
 */
export class GC extends AbstractStruct {
  get deleted () {
    return true
  }

  delete () {}

  /**
   * @param {GC} right
   * @return {boolean}
   */
  mergeWith (right) {
    if (this.constructor !== right.constructor) {
      return false
    }
    this.length += right.length
    return true
  }

  /**
   * @param {Transaction} transaction
   * @param {number} offset
   */
  integrate (transaction, offset) {
    if (offset > 0) {
      this.id.clock += offset
      this.length -= offset
    }
    addToIdSet(transaction.deleteSet, this.id.client, this.id.clock, this.length)
    addStructToIdSet(transaction.insertSet, this)
    addStruct(transaction.doc.store, this)
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    encoder.writeInfo(structGCRefNumber)
    encoder.writeLen(this.length - offset)
  }

  /**
   * @param {Transaction} transaction
   * @param {StructStore} store
   * @return {null | number}
   */
  getMissing (transaction, store) {
    return null
  }
}
