
/**
 * @typedef {import('../Struct/Type.js').default} YType
 * @typedef {import('../Y.js').default} Y
 */

/**
 * Check if `parent` is a parent of `child`.
 *
 * @param {YType | Y} parent
 * @param {YType | Y} child
 * @return {Boolean} Whether `parent` is a parent of `child`.
 *
 * @public
 */
export default function isParentOf (parent, child) {
  child = child._parent
  while (child !== null) {
    if (child === parent) {
      return true
    }
    child = child._parent
  }
  return false
}
