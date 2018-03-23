
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
    const path = []
    let type = this.target
    const y = type._y
    while (type !== this.currentTarget && type !== y) {
      let parent = type._parent
      if (type._parentSub !== null) {
        path.unshift(type._parentSub)
      } else {
        // parent is array-ish
        for (let [i, child] of parent) {
          if (child === type) {
            path.unshift(i)
            break
          }
        }
      }
      type = parent
    }
    return path
  }
}
