import { Y } from '../utils/Y.js' // eslint-disable-line
import { ID, createID } from '../utils/ID.js' // eslint-disable-line
import { Transaction } from '../utils/Transaction.js' // eslint-disable-line
import * as encoding from 'lib0/encoding.js' // eslint-disable-line
import * as error from 'lib0/error.js'

// eslint-disable-next-line
export class AbstractStruct {
  /**
   * @param {ID} id
   */
  constructor (id) {
    /**
     * The uniqe identifier of this struct.
     * @type {ID}
     * @readonly
     */
    this.id = id
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
   * @type {number}
   */
  get length () {
    throw error.methodUnimplemented()
  }
  /**
   * @type {boolean}
   */
  get deleted () {
    throw error.methodUnimplemented()
  }
  /**
   * @param {encoding.Encoder} encoder The encoder to write data to.
   * @param {number} offset
   * @param {number} encodingRef
   * @private
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

export class AbstractRef {
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
   * @return {AbstractStruct}
   */
  toStruct (transaction) {
    throw error.methodUnimplemented()
  }
}
