/**
 * Type that maps from Yjs type to Target type.
 * Used to implement double bindings.
 *
 * @private
 * @template Y
 * @template T
 */
export class BindMapping {
  /**
   */
  constructor () {
    /**
     * @type Map<Y, T>
     */
    this.yt = new Map()
    /**
     * @type Map<T, Y>
     */
    this.ty = new Map()
  }
  /**
   * Map y to t. Removes all existing bindings from y and t
   * @param {Y} y
   * @param {T} t
   */
  bind (y, t) {
    const existingT = this.yt.get(y)
    if (existingT !== undefined) {
      this.ty.delete(existingT)
    }
    const existingY = this.ty.get(t)
    if (existingY !== undefined) {
      this.yt.delete(existingY)
    }
    this.yt.set(y, t)
    this.ty.set(t, y)
  }
  /**
   * @param {Y} y
   * @return {boolean}
   */
  hasY (y) {
    return this.yt.has(y)
  }
  /**
   * @param {T} t
   * @return {boolean}
   */
  hasT (t) {
    return this.ty.has(t)
  }
  /**
   * @param {Y} y
   * @return {T}
   */
  getY (y) {
    return this.yt.get(y)
  }
  /**
   * @param {T} t
   * @return {Y}
   */
  getT (t) {
    return this.ty.get(t)
  }
}
