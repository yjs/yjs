export default class NamedEventHandler {
  constructor () {
    this._eventListener = {}
  }
  on (name, f) {
    if (this._eventListener[name] == null) {
      this._eventListener[name] = []
    }
    this._eventListener[name].push(f)
  }
  off (name, f) {
    if (name == null || f == null) {
      throw new Error('You must specify event name and function!')
    }
    let listener = this._eventListener[name] || []
    this._eventListener[name] = listener.filter(e => e !== f)
  }
  emit (name, value) {
    let listener = this._eventListener[name] || []
    if (name === 'error' && listener.length === 0) {
      console.error(value)
    }
    listener.forEach(l => l(value))
  }
  destroy () {
    this._eventListener = null
  }
}
