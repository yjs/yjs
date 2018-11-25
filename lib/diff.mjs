/**
 * @module diff
 */

/**
 * A SimpleDiff describes a change on a String.
 *
 * @example
 * console.log(a) // the old value
 * console.log(b) // the updated value
 * // Apply changes of diff (pseudocode)
 * a.remove(diff.pos, diff.remove) // Remove `diff.remove` characters
 * a.insert(diff.pos, diff.insert) // Insert `diff.insert`
 * a === b // values match
 *
 * @typedef {Object} SimpleDiff
 * @property {Number} pos The index where changes were applied
 * @property {Number} remove The number of characters to delete starting
 *                                  at `index`.
 * @property {String} insert The new text to insert at `index` after applying
 *                           `delete`
 */

/**
 * Create a diff between two strings. This diff implementation is highly
 * efficient, but not very sophisticated.
 *
 * @public
 * @param {String} a The old version of the string
 * @param {String} b The updated version of the string
 * @return {SimpleDiff} The diff description.
 */
export const simpleDiff = (a, b) => {
  let left = 0 // number of same characters counting from left
  let right = 0 // number of same characters counting from right
  while (left < a.length && left < b.length && a[left] === b[left]) {
    left++
  }
  if (left !== a.length || left !== b.length) {
    // Only check right if a !== b
    while (right + left < a.length && right + left < b.length && a[a.length - right - 1] === b[b.length - right - 1]) {
      right++
    }
  }
  return {
    pos: left, // TODO: rename to index (also in type above)
    remove: a.length - left - right,
    insert: b.slice(left, b.length - right)
  }
}
