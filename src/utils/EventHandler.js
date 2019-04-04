import { Transaction } from './Transaction.js' // eslint-disable-line
import { YEvent } from './YEvent.js' // eslint-disable-line
import * as f from 'lib0/function.js'

/**
 * General event handler implementation.
 *
 * @template ARG0, ARG1
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
 */
export const create = () => new EventHandler()

/**
 * Adds an event listener that is called when
 * {@link EventHandler#callEventListeners} is called.
 *
 * @template ARG0,ARG1
 * @param {EventHandler<ARG0,ARG1>} eventHandler
 * @param {function(ARG0,ARG1):void} f The event handler.
 */
export const addEventListener = (eventHandler, f) =>
  eventHandler.l.push(f)

/**
 * Removes an event listener.
 *
 * @template ARG0,ARG1
 * @param {EventHandler<ARG0,ARG1>} eventHandler
 * @param {function(ARG0,ARG1):void} f The event handler that was added with
 *                     {@link EventHandler#addEventListener}
 */
export const removeEventListener = (eventHandler, f) => {
  eventHandler.l = eventHandler.l.filter(g => f !== g)
}

/**
 * Removes all event listeners.
 * @template ARG0,ARG1
 * @param {EventHandler<ARG0,ARG1>} eventHandler
 */
export const removeAllEventListeners = eventHandler => {
  eventHandler.l.length = 0
}

/**
 * Call all event listeners that were added via
 * {@link EventHandler#addEventListener}.
 *
 * @template ARG0,ARG1
 * @param {EventHandler<ARG0,ARG1>} eventHandler
 * @param {[ARG0,ARG1]} args
 */
export const callEventListeners = (eventHandler, args) =>
  f.callAll(eventHandler.l, args)
