import { AbstractStruct } from './AbstractStruct.js'
import { addStruct } from '../utils/StructStore.js'
import { addToIdSet, addStructToIdSet } from '../utils/IdSet.js'
import { createID } from '../utils/ID.js'

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
   * @param {import('../utils/Transaction.js').Transaction} transaction
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
   * @param {import('../utils/UpdateEncoder.js').UpdateEncoderV1 | import('../utils/UpdateEncoder.js').UpdateEncoderV2} encoder
   * @param {number} offset
   * @param {number} offsetEnd
   */
  write (encoder, offset, offsetEnd) {
    encoder.writeInfo(structGCRefNumber)
    encoder.writeLen(this.length - offset - offsetEnd)
  }

  /**
   * @param {import('../utils/Transaction.js').Transaction} _transaction
   * @param {import('../utils/StructStore.js').StructStore} _store
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
