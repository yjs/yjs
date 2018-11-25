/**
 * @module provider/ydb
 */

import * as globals from './globals.js'

export const Class = class NamedEventHandler {
  constructor () {
    this.l = globals.createMap()
  }
  on (eventname, f) {
    const l = this.l
    let h = l.get(eventname)
    if (h === undefined) {
      h = globals.createSet()
      l.set(eventname, h)
    }
    h.add(f)
  }
}

export const fire = (handler, eventname, event) =>
  handler.l.get(eventname).forEach(f => f(event))
