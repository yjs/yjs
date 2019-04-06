
import {
  isDeleted,
  AbstractItem, AbstractType, Transaction, AbstractStruct // eslint-disable-line
} from '../internals.js'

/**
 * @module utils
 */

/**
 * YEvent describes the changes on a YType.
 */
export class YEvent {
  /**
   * @param {AbstractType<any>} target The changed type.
   * @param {Transaction} transaction
   */
  constructor (target, transaction) {
    /**
     * The type on which this event was created on.
     * @type {AbstractType<any>}
     */
    this.target = target
    /**
     * The current target on which the observe callback is called.
     * @type {AbstractType<any>}
     */
    this.currentTarget = target
    /**
     * The transaction that triggered this event.
     * @type {Transaction}
     */
    this.transaction = transaction
  }

  /**
   * Computes the path from `y` to the changed type.
   *
   * The following property holds:
   * @example
   *   let type = y
   *   event.path.forEach(dir => {
   *     type = type.get(dir)
   *   })
   *   type === event.target // => true
   */
  get path () {
    // @ts-ignore _item is defined because target is integrated
    return getPathTo(this.currentTarget, this.target)
  }

  /**
   * Check if a struct is deleted by this event.
   *
   * @param {AbstractStruct} struct
   * @return {boolean}
   */
  deletes (struct) {
    return isDeleted(this.transaction.deleteSet, struct.id)
  }

  /**
   * Check if a struct is added by this event.
   *
   * @param {AbstractStruct} struct
   * @return {boolean}
   */
  adds (struct) {
    return struct.id.clock > (this.transaction.beforeState.get(struct.id.client) || 0)
  }
}

/**
 * Compute the path from this type to the specified target.
 *
 * @example
 *   // `child` should be accessible via `type.get(path[0]).get(path[1])..`
 *   const path = type.getPathTo(child)
 *   // assuming `type instanceof YArray`
 *   console.log(path) // might look like => [2, 'key1']
 *   child === type.get(path[0]).get(path[1])
 *
 * @param {AbstractType<any>} parent
 * @param {AbstractType<any>} child target
 * @return {Array<string|number>} Path to the target
 */
const getPathTo = (parent, child) => {
  const path = []
  while (child._item !== null && child !== parent) {
    if (child._item.parentSub !== null) {
      // parent is map-ish
      path.unshift(child._item.parentSub)
    } else {
      // parent is array-ish
      let i = 0
      let c = child._item.parent._start
      while (c !== child._item && c !== null) {
        if (!c.deleted) {
          i++
        }
        c = c.right
      }
      path.unshift(i)
    }
    child = child._item.parent
  }
  return path
}
