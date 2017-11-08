
export default class YEvent {
  constructor (target) {
    this.target = target
    this._path = null
  }
  get path () {
    if (this._path !== null) {
      return this._path
    } else {
      const path = []
      let type = this.target
      const y = type._y
      while (type._parent !== y) {
        let parent = type._parent
        if (type._parentSub !== null) {
          path.push(type._parentSub)
        } else {
          // parent is array-ish
          for (let [i, child] of parent) {
            if (child === type) {
              path.push(i)
              break
            }
          }
        }
        type = parent
      }
      this._path = path
      return path
    }
  }
}
