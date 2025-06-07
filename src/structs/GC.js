import {
  AbstractStruct,
  addStruct,
  addStructToIdSet,
  addToIdSet,
  createID,
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
   * @param {number} offset - @todo remove offset parameter
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
   * @param {number} offsetEnd
   */
  write (encoder, offset, offsetEnd) {
    encoder.writeInfo(structGCRefNumber)
    encoder.writeLen(this.length - offset - offsetEnd)
  }

  /**
   * @param {Transaction} _transaction
   * @param {StructStore} _store
   * @return {null | number}
   */
  getMissing (_transaction, _store) {
    return null
  }

  /**
   * gc structs can't be spliced.
   *
   * If this feature is required in the future, then need to try to merge this struct after
   * transaction.
   *
   * @param {number} diff
   */
  splice (diff) {
    const other = new GC(createID(this.id.client, this.id.clock + diff), this.length - diff)
    this.length = diff
    return other
  }
}
