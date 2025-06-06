import {
  readYArray,
  readYMap,
  readYText,
  readYXmlElement,
  readYXmlFragment,
  readYXmlHook,
  readYXmlText,
  UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, StructStore, Transaction, Item, AbstractType // eslint-disable-line
} from '../internals.js'

import * as error from 'lib0/error'

/**
 * @type {Array<function(UpdateDecoderV1 | UpdateDecoderV2):AbstractType<any>>}
 * @private
 */
export const typeRefs = [
  readYArray,
  readYMap,
  readYText,
  readYXmlElement,
  readYXmlFragment,
  readYXmlHook,
  readYXmlText
]

export const YArrayRefID = 0
export const YMapRefID = 1
export const YTextRefID = 2
export const YXmlElementRefID = 3
export const YXmlFragmentRefID = 4
export const YXmlHookRefID = 5
export const YXmlTextRefID = 6

/**
 * @private
 */
export class ContentType {
  /**
   * @param {AbstractType<any>} type
   */
  constructor (type) {
    /**
     * @type {AbstractType<any>}
     */
    this.type = type
  }

  /**
   * @return {number}
   */
  getLength () {
    return 1
  }

  /**
   * @return {Array<any>}
   */
  getContent () {
    return [this.type]
  }

  /**
   * @return {boolean}
   */
  isCountable () {
    return true
  }

  /**
   * @return {ContentType}
   */
  copy () {
    return new ContentType(this.type._copy())
  }

  /**
   * @param {number} _offset
   * @return {ContentType}
   */
  splice (_offset) {
    throw error.methodUnimplemented()
  }

  /**
   * @param {ContentType} _right
   * @return {boolean}
   */
  mergeWith (_right) {
    return false
  }

  /**
   * @param {Transaction} transaction
   * @param {Item} item
   */
  integrate (transaction, item) {
    this.type._integrate(transaction.doc, item)
  }

  /**
   * @param {Transaction} transaction
   */
  delete (transaction) {
    let item = this.type._start
    while (item !== null) {
      if (!item.deleted) {
        item.delete(transaction)
      } else if (!transaction.insertSet.hasId(item.id)) {
        // This will be gc'd later and we want to merge it if possible
        // We try to merge all deleted items after each transaction,
        // but we have no knowledge about that this needs to be merged
        // since it is not in transaction.ds. Hence we add it to transaction._mergeStructs
        transaction._mergeStructs.push(item)
      }
      item = item.right
    }
    this.type._map.forEach(item => {
      if (!item.deleted) {
        item.delete(transaction)
      } else if (!transaction.insertSet.hasId(item.id)) {
        // same as above
        transaction._mergeStructs.push(item)
      }
    })
    transaction.changed.delete(this.type)
  }

  /**
   * @param {Transaction} tr
   */
  gc (tr) {
    let item = this.type._start
    while (item !== null) {
      item.gc(tr, true)
      item = item.right
    }
    this.type._start = null
    this.type._map.forEach(/** @param {Item | null} item */ (item) => {
      while (item !== null) {
        item.gc(tr, true)
        item = item.left
      }
    })
    this.type._map = new Map()
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {number} _offset
   */
  write (encoder, _offset) {
    this.type._write(encoder)
  }

  /**
   * @return {number}
   */
  getRef () {
    return 7
  }
}

/**
 * @private
 *
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
 * @return {ContentType}
 */
export const readContentType = decoder => new ContentType(typeRefs[decoder.readTypeRef()](decoder))
