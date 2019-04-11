
import { AbstractType } from '../internals.js' // eslint-disable-line

/**
 * Check if `parent` is a parent of `child`.
 *
 * @param {AbstractType<any>} parent
 * @param {AbstractType<any>} child
 * @return {Boolean} Whether `parent` is a parent of `child`.
 *
 * @private
 * @function
 */
export const isParentOf = (parent, child) => {
  while (child._item !== null) {
    if (child === parent) {
      return true
    }
    child = child._item.parent
  }
  return false
}
