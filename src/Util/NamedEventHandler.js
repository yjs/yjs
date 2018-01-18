export default class NamedEventHandler {
  constructor () {
    this._eventListener = new Map()
    this._stateListener = new Map()
  }
  _getListener (name) {
    let listeners = this._eventListener.get(name)
    if (listeners === undefined) {
      listeners = {
        once: new Set(),
        on: new Set()
      }
      this._eventListener.set(name, listeners)
    }
    return listeners
  }
  once (name, f) {
    let listeners = this._getListener(name)
    listeners.once.add(f)
  }
  on (name, f) {
    let listeners = this._getListener(name)
    listeners.on.add(f)
  }
  _initStateListener (name) {
    let state = this._stateListener.get(name)
    if (state === undefined) {
      state = {}
      state.promise = new Promise(function (resolve) {
        state.resolve = resolve
      })
      this._stateListener.set(name, state)
    }
    return state
  }
  when (name) {
    return this._initStateListener(name).promise
  }
  off (name, f) {
    if (name == null || f == null) {
      throw new Error('You must specify event name and function!')
    }
    const listener = this._eventListener.get(name)
    if (listener !== undefined) {
      listener.on.delete(f)
      listener.once.delete(f)
    }
  }
  emit (name, ...args) {
    this._initStateListener(name).resolve()
    const listener = this._eventListener.get(name)
    if (listener !== undefined) {
      listener.on.forEach(f => f.apply(null, args))
      listener.once.forEach(f => f.apply(null, args))
      listener.once = new Set()
    } else if (name === 'error') {
      console.error(args[0])
    }
  }
  destroy () {
    this._eventListener = null
  }
}
