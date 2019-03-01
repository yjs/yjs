/**
 * @module utils
 */

/**
 * General event handler implementation.
 */
export class EventHandler {
  constructor () {
    this.eventListeners = []
  }

  /**
   * To prevent memory leaks, call this method when the eventListeners won't be
   * used anymore.
   */
  destroy () {
    this.eventListeners = null
  }

  /**
   * Adds an event listener that is called when
   * {@link EventHandler#callEventListeners} is called.
   *
   * @param {Function} f The event handler.
   */
  addEventListener (f) {
    this.eventListeners.push(f)
  }

  /**
   * Removes an event listener.
   *
   * @param {Function} f The event handler that was added with
   *                     {@link EventHandler#addEventListener}
   */
  removeEventListener (f) {
    this.eventListeners = this.eventListeners.filter(g => f !== g)
  }

  /**
   * Removes all event listeners.
   */
  removeAllEventListeners () {
    this.eventListeners = []
  }

  /**
   * Call all event listeners that were added via
   * {@link EventHandler#addEventListener}.
   *
   * @param {Transaction} transaction The transaction object
   * @param {YEvent} event An event object that describes the change on a type.
   */
  callEventListeners (transaction, event) {
    for (var i = 0; i < this.eventListeners.length; i++) {
      try {
        const f = this.eventListeners[i]
        f(event, transaction)
      } catch (e) {
        /*
          Your observer threw an error. This error was caught so that Yjs
          can ensure data consistency! In order to debug this error you
          have to check "Pause On Caught Exceptions" in developer tools.
        */
        console.error(e)
      }
    }
  }
}
