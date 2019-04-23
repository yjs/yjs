
import {
  AbstractItem,
  AbstractItemRef,
  computeItemParams,
  readYArray,
  readYMap,
  readYText,
  readYXmlElement,
  readYXmlFragment,
  readYXmlHook,
  readYXmlText,
  StructStore, Y, GC, Transaction, ID, AbstractType // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js' // eslint-disable-line
import * as decoding from 'lib0/decoding.js'

/**
 * @private
 */
export const structTypeRefNumber = 7

/**
 * @type {Array<function(decoding.Decoder):AbstractType<any>>}
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
export class ItemType extends AbstractItem {
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {ID | null} origin
   * @param {AbstractItem | null} right
   * @param {ID | null} rightOrigin
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @param {AbstractType<any>} type
   */
  constructor (id, left, origin, right, rightOrigin, parent, parentSub, type) {
    super(id, left, origin, right, rightOrigin, parent, parentSub)
    this.type = type
  }

  getContent () {
    return [this.type]
  }
  /**
   * @param {ID} id
   * @param {AbstractItem | null} left
   * @param {ID | null} origin
   * @param {AbstractItem | null} right
   * @param {ID | null} rightOrigin
   * @param {AbstractType<any>} parent
   * @param {string | null} parentSub
   * @return {ItemType}
   */
  copy (id, left, origin, right, rightOrigin, parent, parentSub) {
    return new ItemType(id, left, origin, right, rightOrigin, parent, parentSub, this.type._copy())
  }
  /**
   * @param {Transaction} transaction
   */
  integrate (transaction) {
    super.integrate(transaction)
    this.type._integrate(transaction.y, this)
  }
  /**
   * @param {encoding.Encoder} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    super.write(encoder, offset, structTypeRefNumber)
    this.type._write(encoder)
  }
  /**
   * Mark this Item as deleted.
   *
   * @param {Transaction} transaction The Yjs instance
   * @private
   */
  delete (transaction) {
    super.delete(transaction)
    transaction.changed.delete(this.type)
    transaction.changedParentTypes.delete(this.type)
  }

  /**
   * @param {Transaction} transaction
   * @param {StructStore} store
   */
  gcChildren (transaction, store) {
    let item = this.type._start
    while (item !== null) {
      item.gc(transaction, store)
      item = item.right
    }
    this.type._start = null
    this.type._map.forEach(item => {
      while (item !== null) {
        item.gc(transaction, store)
        // @ts-ignore
        item = item.left
      }
    })
    this._map = new Map()
  }

  /**
   * @param {Transaction} transaction
   * @param {StructStore} store
   */
  gc (transaction, store) {
    this.gcChildren(transaction, store)
    super.gc(transaction, store)
  }
}

/**
 * @private
 */
export class ItemTypeRef extends AbstractItemRef {
  /**
   * @param {decoding.Decoder} decoder
   * @param {ID} id
   * @param {number} info
   */
  constructor (decoder, id, info) {
    super(decoder, id, info)
    const typeRef = decoding.readVarUint(decoder)
    /**
     * @type {AbstractType<any>}
     */
    this.type = typeRefs[typeRef](decoder)
  }
  /**
   * @param {Transaction} transaction
   * @param {StructStore} store
   * @param {number} offset
   * @return {ItemType|GC}
   */
  toStruct (transaction, store, offset) {
    const { left, right, parent, parentSub } = computeItemParams(transaction, store, this.left, this.right, this.parent, this.parentSub, this.parentYKey)
    return parent === null
      ? new GC(this.id, this.length)
      : new ItemType(
        this.id,
        left,
        this.left,
        right,
        this.right,
        parent,
        parentSub,
        this.type
      )
  }
}
