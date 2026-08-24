/**
 * General event handler implementation.
 *
 * @template ARG0, ARG1
 *
 * @private
 */
export class EventHandler {
  constructor () {
    /**
     * @type {Array<function(ARG0, ARG1):void>}
     */
    this.l = []
  }
}

/**
 * @template ARG0,ARG1
 * @returns {EventHandler<ARG0,ARG1>}
 *
 * @private
 * @function
 */
export const createEventHandler = () => new EventHandler()

/**
 * Adds an event listener that is called when
 * {@link EventHandler#callEventListeners} is called.
 *
 * @template ARG0,ARG1
 * @param {EventHandler<ARG0,ARG1>} eventHandler
 * @param {function(ARG0,ARG1):void} f The event handler.
 *
 * @private
 * @function
 */
export const addEventHandlerListener = (eventHandler, f) =>
  eventHandler.l.push(f)

/**
 * Removes an event listener.
 *
 * @template ARG0,ARG1
 * @param {EventHandler<ARG0,ARG1>} eventHandler
 * @param {function(ARG0,ARG1):void} f The event handler that was added with
 *                     {@link EventHandler#addEventListener}
 *
 * @private
 * @function
 */
export const removeEventHandlerListener = (eventHandler, f) => {
  const l = eventHandler.l
  const len = l.length
  eventHandler.l = l.filter(g => f !== g)
  if (len === eventHandler.l.length) {
    console.error('[yjs] Tried to remove event handler that doesn\'t exist.')
  }
}

/**
 * Removes all event listeners.
 * @template ARG0,ARG1
 * @param {EventHandler<ARG0,ARG1>} eventHandler
 *
 * @private
 * @function
 */
export const removeAllEventHandlerListeners = eventHandler => {
  eventHandler.l.length = 0
}

/**
 * Call all event listeners that were added via
 * {@link EventHandler#addEventListener}.
 *
 * Each listener is called in a try-catch. If one throws, the error is
 * re-thrown after all remaining listeners have been called. This ensures
 * that a single throwing listener cannot permanently break the observer
 * chain — all other listeners still receive the event.
 *
 * @template ARG0,ARG1
 * @param {EventHandler<ARG0,ARG1>} eventHandler
 * @param {ARG0} arg0
 * @param {ARG1} arg1
 *
 * @private
 * @function
 */
export const callEventHandlerListeners = (eventHandler, arg0, arg1) => {
  const listeners = eventHandler.l
  let err = null
  for (let i = 0; i < listeners.length; i++) {
    try {
      listeners[i](arg0, arg1)
    } catch (e) {
      err = e
    }
  }
  if (err !== undefined) {
    throw err
  }
}
