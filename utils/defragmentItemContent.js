
/**
 * @module utils
 */

import * as ID from '../utils/ID.js'
import { ItemJSON } from '../structs/ItemJSON.js'
import { ItemString } from '../structs/ItemString.js'

/**
 * Try to merge all items in os with their successors.
 *
 * Some transformations (like delete) fragment items.
 * Item(c: 'ab') + Delete(1,1) + Delete(0, 1) -> Item(c: 'a',deleted);Item(c: 'b',deleted)
 *
 * This functions merges the fragmented nodes together:
 * Item(c: 'a',deleted);Item(c: 'b',deleted) -> Item(c: 'ab', deleted)
 *
 * TODO: The Tree implementation does not support deletions in-spot.
 *       This is why all deletions must be performed after the traversal.
 *
 */
export const defragmentItemContent = y => {
  const os = y.os
  if (os.length < 2) {
    return
  }
  let deletes = []
  let node = os.findSmallestNode()
  let next = node.next()
  while (next !== null) {
    let a = node.val
    let b = next.val
    if (
      (a instanceof ItemJSON || a instanceof ItemString) &&
      a.constructor === b.constructor &&
      a._deleted === b._deleted &&
      a._right === b &&
      (ID.createID(a._id.user, a._id.clock + a._length)).equals(b._id)
    ) {
      a._right = b._right
      if (a instanceof ItemJSON) {
        a._content = a._content.concat(b._content)
      } else if (a instanceof ItemString) {
        a._content += b._content
      }
      // delete b later
      deletes.push(b._id)
      // do not iterate node!
      // !(node = next)
    } else {
      // not able to merge node, get next node
      node = next
    }
    // update next
    next = next.next()
  }
  for (let i = deletes.length - 1; i >= 0; i--) {
    os.delete(deletes[i])
  }
}
