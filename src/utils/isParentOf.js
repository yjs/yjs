/**
 * @module utils
 */

import { Y } from '../utils/Y.js' // eslint-disable-line
import { Type } from '../structs/Type.js' // eslint-disable-line

/**
 * Check if `parent` is a parent of `child`.
 *
 * @param {Type | Y} parent
 * @param {Type | Y} child
 * @return {Boolean} Whether `parent` is a parent of `child`.
 *
 * @public
 */
export const isParentOf = (parent, child) => {
  child = child._parent
  while (child !== null) {
    if (child === parent) {
      return true
    }
    child = child._parent
  }
  return false
}
