
// TODO: rename mutex

/**
 * Creates a mutual exclude function with the following property:
 *
 * @example
 * const mutualExclude = createMutualExclude()
 * mutualExclude(function () {
 *   // This function is immediately executed
 *   mutualExclude(function () {
 *     // This function is never executed, as it is called with the same
 *     // mutualExclude
 *   })
 * })
 *
 * @return {Function} A mutual exclude function
 * @public
 */
export function createMutualExclude () {
  var token = true
  return function mutualExclude (f) {
    if (token) {
      token = false
      try {
        f()
      } catch (e) {
        console.error(e)
      }
      token = true
    }
  }
}
