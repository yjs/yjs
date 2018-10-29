/**
 * @typedef {import("../Y.js").default} Y
 * @typedef {import("../Struct/Type.js").default} YType
 * @typedef {import("../Struct/Item.js").default} Item
 */

/**
 * YEvent describes the changes on a YType.
 */
export default class YEvent {
  /**
   * @param {YType} target The changed type.
   */
  constructor (target) {
    /**
     * The type on which this event was created on.
     * @type {YType}
     */
    this.target = target
    /**
     * The current target on which the observe callback is called.
     * @type {YType}
     */
    this.currentTarget = target
  }

  /**
   * Computes the path from `y` to the changed type.
   *
   * The following property holds:
   * @example
   *   let type = y
   *   event.path.forEach(function (dir) {
   *     type = type.get(dir)
   *   })
   *   type === event.target // => true
   */
  get path () {
    return this.currentTarget.getPathTo(this.target)
  }
}
