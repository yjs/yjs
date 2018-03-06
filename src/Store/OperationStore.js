import Tree from '../Util/Tree.js'
import RootID from '../Util/ID/RootID.js'
import { getStruct } from '../Util/structReferences.js'
import { logID } from '../MessageHandler/messageToString.js'

export default class OperationStore extends Tree {
  constructor (y) {
    super()
    this.y = y
  }
  logTable () {
    const items = []
    this.iterate(null, null, function (item) {
      items.push({
        id: logID(item),
        origin: logID(item._origin === null ? null : item._origin._lastId),
        left: logID(item._left === null ? null : item._left._lastId),
        right: logID(item._right),
        right_origin: logID(item._right_origin),
        parent: logID(item._parent),
        parentSub: item._parentSub,
        deleted: item._deleted,
        content: JSON.stringify(item._content)
      })
    })
    console.table(items)
  }
  get (id) {
    let struct = this.find(id)
    if (struct === null && id instanceof RootID) {
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
