import * as error from 'lib0/error'

export class AbstractStruct {
  /**
   * @param {ID} id
   * @param {number} length
   */
  constructor (id, length) {
    this.id = id
    this.length = length
  }

  /**
   * @type {boolean}
   */
  get deleted () {
    throw error.methodUnimplemented()
  }

  /**
   * Merge this struct with the item to the right.
   * This method is already assuming that `this.id.clock + this.length === this.id.clock`.
   * Also this method does *not* remove right from StructStore!
   * @param {GC|Item|Skip} _right
   * @return {boolean} whether this merged with right
   */
  mergeWith (_right) {
    return false
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} _encoder The encoder to write data to.
   * @param {number} _offset
   * @param {number} _encodingRef
   */
  write (_encoder, _offset, _encodingRef) {
    throw error.methodUnimplemented()
  }

  /**
   * @param {Transaction} _transaction
   * @param {number} _offset
   */
  integrate (_transaction, _offset) {
    throw error.methodUnimplemented()
  }

  /**
   * @param {number} _diff
   * @return {GC|Item|Skip}
   */
  splice (_diff) {
    throw error.methodUnimplemented()
  }
}

/**
 * @param {IdSet} idSet
 * @param {AbstractStruct} struct
 *
 * @private
 * @function
 */
export const addStructToIdSet = (idSet, struct) => idSet.add(struct.id.client, struct.id.clock, struct.length)
