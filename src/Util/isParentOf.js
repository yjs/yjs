
/**
 * Check if `parent` is a parent of `child`.
 *
 * @param {Type} parent
 * @param {Type} child
 * @return {Boolean} Whether `parent` is a parent of `child`.
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
