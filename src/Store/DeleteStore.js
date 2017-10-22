import Tree from '../Util/Tree.js'
import ID from '../Util/ID.js'

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

export default class DeleteStore extends Tree {
  logTable () {
    const deletes = []
    this.iterate(null, null, function (n) {
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
  // TODO: put this in function (and all other methods)
  applyMissingDeletesOnStruct (struct) {
    const strID = struct._id
    // find most right delete
    let n = this.findWithUpperBound(new ID(strID.user, strID.clock + struct._length - 1))
    if (n === null || n._id.user !== strID.user || n._id.clock + n.len <= strID.clock) {
      // struct is not deleted
      return null
    }
    // TODO:
    // * iterate to the right and apply new Delete's
    throw new Error('Not implemented!')
  }
  /*
   * Mark an operation as deleted. returns the deleted node
   */
  markDeleted (id, length) {
    if (length == null) {
      throw new Error('length must be defined')
    }
    var n = this.findWithUpperBound(id)
    if (n != null && n._id.user === id.user) {
      if (n._id.clock <= id.clock && id.clock <= n._id.clock + n.len) {
        // id is in n's range
        var diff = id.clock + length - (n._id.clock + n.len) // overlapping right
        if (diff > 0) {
          // id+length overlaps n
          if (!n.gc) {
            n.len += diff
          } else {
            diff = n._id.clock + n.len - id.clock // overlapping left (id till n.end)
            if (diff < length) {
              // a partial deletion
              let nId = id.clone()
              nId.clock += diff
              n = new DSNode(nId, length - diff, false)
              this.put(n)
            } else {
              // already gc'd
              throw new Error(
                'DS reached an inconsistent state. Please report this issue!'
              )
            }
          }
        } else {
          // no overlapping, already deleted
          return n
        }
      } else {
        // cannot extend left (there is no left!)
        n = new DSNode(id, length, false)
        this.put(n) // TODO: you double-put !!
      }
    } else {
      // cannot extend left
      n = new DSNode(id, length, false)
      this.put(n)
    }
    // can extend right?
    var next = this.findNext(n._id)
    if (
      next != null &&
      n._id.user === next._id.user &&
      n._id.clock + n.len >= next._id.clock
    ) {
      diff = n._id.clock + n.len - next._id.clock // from next.start to n.end
      while (diff >= 0) {
        // n overlaps with next
        if (next.gc) {
          // gc is stronger, so reduce length of n
          n.len -= diff
          if (diff >= next.len) {
            // delete the missing range after next
            diff = diff - next.len // missing range after next
            if (diff > 0) {
              this.put(n) // unneccessary? TODO!
              this.markDeleted(new ID(next._id.user, next._id.clock + next.len), diff)
            }
          }
          break
        } else {
          // we can extend n with next
          if (diff > next.len) {
            // n is even longer than next
            // get next.next, and try to extend it
            var _next = this.findNext(next._id)
            this.delete(next._id)
            if (_next == null || n._id.user !== _next._id.user) {
              break
            } else {
              next = _next
              diff = n._id.clock + n.len - next._id.clock // from next.start to n.end
              // continue!
            }
          } else {
            // n just partially overlaps with next. extend n, delete next, and break this loop
            n.len += next.len - diff
            this.delete(next._id)
            break
          }
        }
      }
    }
    this.put(n)
    return n
  }
}
