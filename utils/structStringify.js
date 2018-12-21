
import * as ID from './ID.js'

/**
 * Stringify an item id.
 *
 * @param {ID.ID | ID.RootID} id
 * @return {string}
 */
export const stringifyID = id => id instanceof ID.ID ? `(${id.user},${id.clock})` : `(${id.name},${id.type})`

/**
 * Stringify an item as ID. HHere, an item could also be a Yjs instance (e.g. item._parent).
 *
 * @param {Item | Y | null} item
 * @return {string}
 */
export const stringifyItemID = item => {
  let result
  if (item === null) {
    result = '()'
  } else if (item._id != null) {
    result = stringifyID(item._id)
  } else {
    // must be a Yjs instance
    // Don't include Y in this module, so we prevent circular dependencies.
    result = 'y'
  }
  return result
}

/**
 * Helper utility to convert an item to a readable format.
 *
 * @param {String} name The name of the item class (YText, ItemString, ..).
 * @param {Item} item The item instance.
 * @param {String} [append] Additional information to append to the returned
 *                          string.
 * @return {String} A readable string that represents the item object.
 *
 */
export const logItemHelper = (name, item, append) => {
  const left = item._left !== null ? stringifyID(item._left._lastId) : '()'
  const origin = item._origin !== null ? stringifyID(item._origin._lastId) : '()'
  return `${name}(id:${stringifyItemID(item)},left:${left},origin:${origin},right:${stringifyItemID(item._right)},parent:${stringifyItemID(item._parent)},parentSub:${item._parentSub}${append !== undefined ? ' - ' + append : ''})`
}
