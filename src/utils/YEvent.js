import { AbstractItem } from '../structs/AbstractItem.js' // eslint-disable-line
import { AbstractType } from '../types/AbstractType.js' // eslint-disable-line

/**
 * @module utils
 */

/**
 * YEvent describes the changes on a YType.
 */
export class YEvent {
  /**
   * @param {AbstractType} target The changed type.
   */
  constructor (target) {
    /**
     * The type on which this event was created on.
     * @type {AbstractType}
     */
    this.target = target
    /**
     * The current target on which the observe callback is called.
     * @type {AbstractType}
     */
    this.currentTarget = target
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
    return getPathTo(this.currentTarget, this.target._item)
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
 * @param {AbstractType} parent
 * @param {AbstractItem} child target
 * @return {Array<string|number>} Path to the target
 */
const getPathTo = (parent, child) => {
  const path = []
  while (true) {
    const cparent = child.parent
    if (child.parentSub !== null) {
      // parent is map-ish
      path.unshift(child.parentSub)
    } else {
      // parent is array-ish
      let i = 0
      let c = cparent._start
      while (c !== child && c !== null) {
        if (!c.deleted) {
          i++
        }
        c = c.right
      }
      path.unshift(i)
    }
    if (parent === cparent) {
      return path
    }
    // @ts-ignore parent._item cannot be null, because it is integrated
    child = parent._item
  }
}
