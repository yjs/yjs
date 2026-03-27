/**
 * Check if `parent` is a parent of `child`.
 *
 * @param {YType} parent
 * @param {Item|null} child
 * @return {Boolean} Whether `parent` is a parent of `child`.
 *
 * @private
 * @function
 */
export const isParentOf = (parent, child) => {
  while (child !== null) {
    if (child.parent === parent) {
      return true
    }
    child = /** @type {YType} */ (child.parent)._item
  }
  return false
}
