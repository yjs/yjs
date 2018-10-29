
/**
 * Creates a mutual exclude function with the following property:
 *
 * @example
 * const mutex = createMutex()
 * mutex(function () {
 *   // This function is immediately executed
 *   mutex(function () {
 *     // This function is never executed, as it is called with the same
 *     // mutex function
 *   })
 * })
 *
 * @return {Function} A mutual exclude function
 * @public
 */
export const createMutex = () => {
  let token = true
  return (f, g) => {
    if (token) {
      token = false
      try {
        f()
      } finally {
        token = true
      }
    } else if (g !== undefined) {
      g()
    }
  }
}
