
import {
  StructStore, ID, Transaction // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js' // eslint-disable-line
import * as error from 'lib0/error.js'

export class AbstractStruct {
  /**
   * @param {ID} id
   * @param {number} length
   */
  constructor (id, length) {
    /**
     * The uniqe identifier of this struct.
     * @type {ID}
     * @readonly
     */
    this.id = id
    this.length = length
    this.deleted = false
  }

  /**
   * Merge this struct with the item to the right.
   * This method is already assuming that `this.id.clock + this.length === this.id.clock`.
   * Also this method does *not* remove right from StructStore!
   * @param {AbstractStruct} right
   * @return {boolean} wether this merged with right
   */
  mergeWith (right) {
    return false
  }

  /**
   * @param {encoding.Encoder} encoder The encoder to write data to.
   * @param {number} offset
   * @param {number} encodingRef
   */
  write (encoder, offset, encodingRef) {
    throw error.methodUnimplemented()
  }

  /**
   * @param {Transaction} transaction
   */
  integrate (transaction) {
    throw error.methodUnimplemented()
  }
}

export class AbstractStructRef {
  /**
   * @param {ID} id
   */
  constructor (id) {
    /**
     * @type {Array<ID>}
     */
    this._missing = []
    /**
     * The uniqe identifier of this type.
     * @type {ID}
     */
    this.id = id
  }

  /**
   * @param {Transaction} transaction
   * @return {Array<ID|null>}
   */
  getMissing (transaction) {
    return this._missing
  }

  /**
   * @param {Transaction} transaction
   * @param {StructStore} store
   * @param {number} offset
   * @return {AbstractStruct}
   */
  toStruct (transaction, store, offset) {
    throw error.methodUnimplemented()
  }
}
