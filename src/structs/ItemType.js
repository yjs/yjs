/**
 * @module structs
 */

// TODO: ItemBinary should be able to merge with right (similar to other items). Or the other items (ItemJSON) should not be able to merge - extra byte + consistency

import {
  AbstractItem,
  AbstractItemRef,
  getItemCleanEnd,
  getItemCleanStart,
  getItemType,
  readYArray,
  readYMap,
  readYText,
  readYXmlElement,
  readYXmlFragment,
  readYXmlHook,
  readYXmlText,
  Y, GC, ItemDeleted, Transaction, ID, AbstractType // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js' // eslint-disable-line
import * as decoding from 'lib0/decoding.js'

/**
 * @param {Y} y
 * @param {AbstractItem | null} item
 */
const gcChildren = (y, item) => {
  while (item !== null) {
    item.gc(y)
    item = item.right
  }
}

export const structTypeRefNumber = 7

/**
 * @type {Array<function(decoding.Decoder):AbstractType<any>>}
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
   * @return {AbstractItem} TODO, returns itemtype
   */
  copy (id, left, origin, right, rightOrigin, parent, parentSub) {
    return new ItemType(id, left, origin, right, rightOrigin, parent, parentSub, this.type._copy())
  }
  /**
   * @param {Transaction} transaction
   */
  integrate (transaction) {
    this.type._integrate(transaction.y, this)
    super.integrate(transaction)
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
    const y = transaction.y
    super.delete(transaction)
    transaction.changed.delete(this.type)
    transaction.changedParentTypes.delete(this.type)
    // delete map types
    for (let value of this.type._map.values()) {
      if (!value.deleted) {
        value.delete(transaction)
      }
    }
    // delete array types
    let t = this.type._start
    while (t !== null) {
      if (!t.deleted) {
        t.delete(transaction)
      }
      t = t.right
    }
    if (gcChildren) {
      this.gcChildren(y)
    }
  }

  /**
   * @param {Y} y
   */
  gcChildren (y) {
    gcChildren(y, this.type._start)
    this.type._start = null
    this.type._map.forEach(item => {
      gcChildren(y, item)
    })
    this._map = new Map()
  }

  /**
   * @param {Y} y
   * @return {ItemDeleted|GC}
   */
  gc (y) {
    this.gcChildren(y)
    return super.gc(y)
  }
}

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
   * @param {number} offset
   * @return {ItemType|GC}
   */
  toStruct (transaction, offset) {
    const y = transaction.y
    const store = y.store

    let parent
    if (this.parent !== null) {
      const parentItem = getItemType(store, this.parent)
      switch (parentItem.constructor) {
        case ItemDeleted:
        case GC:
          return new GC(this.id, 1)
      }
      parent = parentItem.type
    } else {
      // @ts-ignore
      parent = y.get(this.parentYKey)
    }

    // TODO: we can probably only feed AbstractType with origins
    return new ItemType(
      this.id,
      this.left === null ? null : getItemCleanEnd(store, this.left),
      this.left,
      this.right === null ? null : getItemCleanStart(store, this.right),
      this.right,
      parent,
      this.parentSub,
      this.type
    )
  }
}
