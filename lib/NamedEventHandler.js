
/**
 * Handles named events.
 */
export class NamedEventHandler {
  constructor () {
    this._eventListener = new Map()
    this._stateListener = new Map()
  }

  /**
   * @private
   * Returns all listeners that listen to a specified name.
   *
   * @param {String} name The query event name.
   */
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

  /**
   * Adds a named event listener. The listener is removed after it has been
   * called once.
   *
   * @param {String} name The event name to listen to.
   * @param {Function} f The function that is executed when the event is fired.
   */
  once (name, f) {
    let listeners = this._getListener(name)
    listeners.once.add(f)
  }

  /**
   * Adds a named event listener.
   *
   * @param {String} name The event name to listen to.
   * @param {Function} f The function that is executed when the event is fired.
   */
  on (name, f) {
    let listeners = this._getListener(name)
    listeners.on.add(f)
  }

  /**
   * @private
   * Init the saved state for an event name.
   */
  _initStateListener (name) {
    let state = this._stateListener.get(name)
    if (state === undefined) {
      state = {}
      state.promise = new Promise(resolve => {
        state.resolve = resolve
      })
      this._stateListener.set(name, state)
    }
    return state
  }

  /**
   * Returns a Promise that is resolved when the event name is called.
   * The Promise is immediately resolved when the event name was called in the
   * past.
   */
  when (name) {
    return this._initStateListener(name).promise
  }

  /**
   * Remove an event listener that was registered with either
   * {@link EventHandler#on} or {@link EventHandler#once}.
   */
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

  /**
   * Emit a named event. All registered event listeners that listen to the
   * specified name will receive the event.
   *
   * @param {String} name The event name.
   * @param {Array} args The arguments that are applied to the event listener.
   */
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
