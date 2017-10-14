import Tree from '../Util/Tree.js'
import ID from '../Util/ID.js'

class DSNode {
  constructor (id, len, gc) {
    this.id = id
    this.len = len
    this.gc = gc
  }
  clone () {
    return new DSNode(this.id, this.len, this.gc)
  }
}

export default class DeleteStore extends Tree {
  isDeleted (id) {
    var n = this.ds.findWithUpperBound(id)
    return n != null && n.id[0] === id[0] && id[1] < n.id[1] + n.len
  }
  /*
   * Mark an operation as deleted. returns the deleted node
   */
  markDeleted (id, length) {
    if (length == null) {
      throw new Error('length must be defined')
    }
    var n = this.findWithUpperBound(id)
    if (n != null && n.id.user === id.user) {
      if (n.id.clock <= id.clock && id.clock <= n.id.clock + n.len) {
        // id is in n's range
        var diff = id.clock + length - (n.id.clock + n.len) // overlapping right
        if (diff > 0) {
          // id+length overlaps n
          if (!n.gc) {
            n.len += diff
          } else {
            diff = n.id.clock + n.len - id.clock // overlapping left (id till n.end)
            if (diff < length) {
              // a partial deletion
              let nId = id.clone()
              nId.clock += diff
              n = new DSNode(nId, length - diff, false)
              this.ds.put(n)
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
        this.ds.put(n) // TODO: you double-put !!
      }
    } else {
      // cannot extend left
      n = new DSNode(id, length, false)
      this.ds.put(n)
    }
    // can extend right?
    var next = this.ds.findNext(n.id)
    if (
      next != null &&
      n.id.user === next.id.user &&
      n.id.clock + n.len >= next.id.clock
    ) {
      diff = n.id.clock + n.len - next.id.clock // from next.start to n.end
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
              this.markDeleted(new ID(next.id.user, next.id.clock + next.len), diff)
            }
          }
          break
        } else {
          // we can extend n with next
          if (diff > next.len) {
            // n is even longer than next
            // get next.next, and try to extend it
            var _next = this.findNext(next.id)
            this.delete(next.id)
            if (_next == null || n.id.user !== _next.id.user) {
              break
            } else {
              next = _next
              diff = n.id.clock + n.len - next.id.clock // from next.start to n.end
              // continue!
            }
          } else {
            // n just partially overlaps with next. extend n, delete next, and break this loop
            n.len += next.len - diff
            this.delete(next.id)
            break
          }
        }
      }
    }
    this.put(n)
    return n
  }
}
