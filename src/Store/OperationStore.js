import Tree from '../Util/Tree.js'
import RootID from '../Util/ID.js'
import { getStruct } from '../Util/structReferences.js'

export default class OperationStore extends Tree {
  get (id) {
    let struct = this.find(id)
    if (struct === null && id instanceof RootID) {
      let Constr = getStruct(id.type)
      struct = new Constr()
      struct._id = id
      this.put(struct)
    }
    return struct
  }
  getItem (id) {
    var item = this.findWithUpperBound(id)
    if (item == null) {
      return null
    }
    var len = item.content != null ? item.content.length : 1 // in case of opContent
    if (id[0] === item.id[0] && id[1] < item.id[1] + len) {
      return item
    } else {
      return null
    }

  }
  // Return an insertion such that id is the first element of content
  // This function manipulates an operation, if necessary
  getInsertionCleanStart (id) {
    var ins = this.getInsertion(id)
    if (ins != null) {
      if (ins.id[1] === id[1]) {
        return ins
      } else {
        var left = Y.utils.copyObject(ins)
        ins.content = left.content.splice(id[1] - ins.id[1])
        ins.id = id
        var leftLid = Y.utils.getLastId(left)
        ins.origin = leftLid
        left.originOf = [ins.id]
        left.right = ins.id
        ins.left = leftLid
        // debugger // check
        this.setOperation(left)
        this.setOperation(ins)
        if (left.gc) {
          this.store.queueGarbageCollector(ins.id)
        }
        return ins
      }
    } else {
      return null
    }
  }
  // Return an insertion such that id is the last element of content
  // This function manipulates an operation, if necessary
  getInsertionCleanEnd (id) {
    var ins = this.getInsertion(id)
    if (ins != null) {
      if (ins.content == null || (ins.id[1] + ins.content.length - 1 === id[1])) {
        return ins
      } else {
        var right = Y.utils.copyObject(ins)
        right.content = ins.content.splice(id[1] - ins.id[1] + 1) // cut off remainder
        right.id = [id[0], id[1] + 1]
        var insLid = Y.utils.getLastId(ins)
        right.origin = insLid
        ins.originOf = [right.id]
        ins.right = right.id
        right.left = insLid
        // debugger // check
        this.setOperation(right)
        this.setOperation(ins)
        if (ins.gc) {
          this.store.queueGarbageCollector(right.id)
        }
        return ins
      }
    } else {
      return null
    }
  }
}
