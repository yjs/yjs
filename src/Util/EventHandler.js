
export default class EventHandler {
  constructor () {
    this.eventListeners = []
  }
  destroy () {
    this.eventListeners = null
  }
  addEventListener (f) {
    this.eventListeners.push(f)
  }
  removeEventListener (f) {
    this.eventListeners = this.eventListeners.filter(function (g) {
      return f !== g
    })
  }
  removeAllEventListeners () {
    this.eventListeners = []
  }
  callEventListeners (event) {
    for (var i = 0; i < this.eventListeners.length; i++) {
      try {
        this.eventListeners[i](event)
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
