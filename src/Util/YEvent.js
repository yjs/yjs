
export default class YEvent {
  constructor (target) {
    this.target = target
    this.currentTarget = target
  }
  get path () {
    const path = []
    let type = this.target
    const y = type._y
    while (type !== this.currentTarget && type !== y) {
      let parent = type._parent
      if (type._parentSub !== null) {
        path.unshift(type._parentSub)
      } else {
        // parent is array-ish
        for (let [i, child] of parent) {
          if (child === type) {
            path.unshift(i)
            break
          }
        }
      }
      type = parent
    }
    return path
  }
}
