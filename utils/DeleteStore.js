/**
 * @module utils
 */

import { Tree } from '../lib/Tree.js'
import * as ID from './ID.js'

class DSNode {
  constructor (id, len, gc) {
    this._id = id
    this.len = len
    this.gc = gc
  }
  clone () {
    return new DSNode(this._id, this.len, this.gc)
  }
}

export class DeleteStore extends Tree {
  logTable () {
    const deletes = []
    this.iterate(null, null, n => {
      deletes.push({
        user: n._id.user,
        clock: n._id.clock,
        len: n.len,
        gc: n.gc
      })
    })
    console.table(deletes)
  }
  isDeleted (id) {
    var n = this.findWithUpperBound(id)
    return n !== null && n._id.user === id.user && id.clock < n._id.clock + n.len
  }
  mark (id, length, gc) {
    if (length === 0) return
    // Step 1. Unmark range
    const leftD = this.findWithUpperBound(ID.createID(id.user, id.clock - 1))
    // Resize left DSNode if necessary
    if (leftD !== null && leftD._id.user === id.user) {
      if (leftD._id.clock < id.clock && id.clock < leftD._id.clock + leftD.len) {
        // node is overlapping. need to resize
        if (id.clock + length < leftD._id.clock + leftD.len) {
          // overlaps new mark range and some more
          // create another DSNode to the right of new mark
          this.put(new DSNode(ID.createID(id.user, id.clock + length), leftD._id.clock + leftD.len - id.clock - length, leftD.gc))
        }
        // resize left DSNode
        leftD.len = id.clock - leftD._id.clock
      } // Otherwise there is no overlapping
    }
    // Resize right DSNode if necessary
    const upper = ID.createID(id.user, id.clock + length - 1)
    const rightD = this.findWithUpperBound(upper)
    if (rightD !== null && rightD._id.user === id.user) {
      if (rightD._id.clock < id.clock + length && id.clock <= rightD._id.clock && id.clock + length < rightD._id.clock + rightD.len) { // we only consider the case where we resize the node
        const d = id.clock + length - rightD._id.clock
        rightD._id = ID.createID(rightD._id.user, rightD._id.clock + d)
        rightD.len -= d
      }
    }
    // Now we only have to delete all inner marks
    const deleteNodeIds = []
    this.iterate(id, upper, m => {
      deleteNodeIds.push(m._id)
    })
    for (let i = deleteNodeIds.length - 1; i >= 0; i--) {
      this.delete(deleteNodeIds[i])
    }
    let newMark = new DSNode(id, length, gc)
    // Step 2. Check if we can extend left or right
    if (leftD !== null && leftD._id.user === id.user && leftD._id.clock + leftD.len === id.clock && leftD.gc === gc) {
      // We can extend left
      leftD.len += length
      newMark = leftD
    }
    const rightNext = this.find(ID.createID(id.user, id.clock + length))
    if (rightNext !== null && rightNext._id.user === id.user && id.clock + length === rightNext._id.clock && gc === rightNext.gc) {
      // We can merge newMark and rightNext
      newMark.len += rightNext.len
      this.delete(rightNext._id)
    }
    if (leftD !== newMark) {
      // only put if we didn't extend left
      this.put(newMark)
    }
  }
  // TODO: exchange markDeleted for mark()
  markDeleted (id, length) {
    this.mark(id, length, false)
  }
}
