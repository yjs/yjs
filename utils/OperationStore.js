/**
 * @module utils
 */

import { Tree } from '../lib/Tree.js'
import * as ID from '../utils/ID.js'
import { getStruct } from '../utils/structReferences.js'
import { GC } from '../structs/GC.js'
import * as stringify from '../utils/structStringify.js'

export class OperationStore extends Tree {
  constructor (y) {
    super()
    this.y = y
  }
  logTable () {
    const items = []
    this.iterate(null, null, item => {
      if (item.constructor === GC) {
        items.push({
          id: stringify.stringifyItemID(item),
          content: item._length,
          deleted: 'GC'
        })
      } else {
        items.push({
          id: stringify.stringifyItemID(item),
          origin: item._origin === null ? '()' : stringify.stringifyID(item._origin._lastId),
          left: item._left === null ? '()' : stringify.stringifyID(item._left._lastId),
          right: stringify.stringifyItemID(item._right),
          right_origin: stringify.stringifyItemID(item._right_origin),
          parent: stringify.stringifyItemID(item._parent),
          parentSub: item._parentSub,
          deleted: item._deleted,
          content: JSON.stringify(item._content)
        })
      }
    })
    console.table(items)
  }
  get (id) {
    let struct = this.find(id)
    if (struct === null && id instanceof ID.RootID) {
      const Constr = getStruct(id.type)
      const y = this.y
      struct = new Constr()
      struct._id = id
      struct._parent = y
      y.transact(() => {
        struct._integrate(y)
      })
      this.put(struct)
    }
    return struct
  }
  // Use getItem for structs with _length > 1
  getItem (id) {
    var item = this.findWithUpperBound(id)
    if (item === null) {
      return null
    }
    const itemID = item._id
    if (id.user === itemID.user && id.clock < itemID.clock + item._length) {
      return item
    } else {
      return null
    }
  }
  // Return an insertion such that id is the first element of content
  // This function manipulates an item, if necessary
  getItemCleanStart (id) {
    var ins = this.getItem(id)
    if (ins === null || ins._length === 1) {
      return ins
    }
    const insID = ins._id
    if (insID.clock === id.clock) {
      return ins
    } else {
      return ins._splitAt(this.y, id.clock - insID.clock)
    }
  }
  // Return an insertion such that id is the last element of content
  // This function manipulates an operation, if necessary
  getItemCleanEnd (id) {
    var ins = this.getItem(id)
    if (ins === null || ins._length === 1) {
      return ins
    }
    const insID = ins._id
    if (insID.clock + ins._length - 1 === id.clock) {
      return ins
    } else {
      ins._splitAt(this.y, id.clock - insID.clock + 1)
      return ins
    }
  }
}
