/**
 * @module utils
 */

import { Y } from '../utils/Y.js' // eslint-disable-line
import { AbstractType } from '../types/AbstractType.js' // eslint-disable-line

/**
 * Check if `parent` is a parent of `child`.
 *
 * @param {AbstractType<any>} parent
 * @param {AbstractType<any>} child
 * @return {Boolean} Whether `parent` is a parent of `child`.
 *
 * @public
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
