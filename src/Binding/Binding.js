
import { createMutualExclude } from '../Util/mutualExclude.js'

export default class Binding {
  constructor (type, target) {
    this.type = type
    this.target = target
    this._mutualExclude = createMutualExclude()
  }
  destroy () {
    this.type = null
    this.target = null
  }
}
