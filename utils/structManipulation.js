
import * as ID from '../utils/ID.js'

/**
 * @private
 * Delete all items in an ID-range.
 * Does not create delete operations!
 * TODO: implement getItemCleanStartNode for better performance (only one lookup).
 */
export const deleteItemRange = (y, user, clock, range, gcChildren) => {
  let item = y.os.getItemCleanStart(ID.createID(user, clock))
  if (item !== null) {
    if (!item._deleted) {
      item._splitAt(y, range)
      item._delete(y, false, true)
    }
    let itemLen = item._length
    range -= itemLen
    clock += itemLen
    if (range > 0) {
      let node = y.os.findNode(ID.createID(user, clock))
      while (node !== null && node.val !== null && range > 0 && node.val._id.equals(ID.createID(user, clock))) {
        const nodeVal = node.val
        if (!nodeVal._deleted) {
          nodeVal._splitAt(y, range)
          nodeVal._delete(y, false, gcChildren)
        }
        const nodeLen = nodeVal._length
        range -= nodeLen
        clock += nodeLen
        node = node.next()
      }
    }
  }
}
