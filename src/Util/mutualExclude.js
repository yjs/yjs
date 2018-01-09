
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
