/**
 * @module utils
 */

import { Type } from '../structs/Type.js' // eslint-disable-line

/**
 * YEvent describes the changes on a YType.
 */
export class YEvent {
  /**
   * @param {Type} target The changed type.
   */
  constructor (target) {
    /**
     * The type on which this event was created on.
     * @type {Type}
     */
    this.target = target
    /**
     * The current target on which the observe callback is called.
     * @type {Type}
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
    return this.currentTarget.getPathTo(this.target)
  }
}
