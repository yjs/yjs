import Tree from '../Util/Tree.js'
import RootID from '../Util/ID.js'
import { getStruct } from '../Util/structReferences.js'

export default class OperationStore extends Tree {
  constructor (y) {
    super()
    this.y = y
  }
  get (id) {
    let struct = this.find(id)
    if (struct === null && id instanceof RootID) {
      let Constr = getStruct(id.type)
      struct = new Constr()
      struct._id = id
      struct._parent = this.y
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
