export default class NamedEventHandler {
  constructor () {
    this._eventListener = new Map()
  }
  on (name, f) {
    let fSet = this._eventListener.get(name)
    if (fSet === undefined) {
      fSet = new Set()
      this._eventListener.set(name, fSet)
    }
    fSet.add(f)
  }
  off (name, f) {
    if (name == null || f == null) {
      throw new Error('You must specify event name and function!')
    }
    const listener = this._eventListener.get(name)
    if (listener !== undefined) {
      listener.remove(f)
    }
  }
  emit (name, ...args) {
    const listener = this._eventListener.get(name)
    if (listener !== undefined) {
      listener.forEach(f => f.apply(null, args))
    } else if (name === 'error') {
      console.error(args[0])
    }
  }
  destroy () {
    this._eventListener = null
  }
}
