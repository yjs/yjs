/**
 * @module utils
 */

import * as ID from '../utils/ID.js'

/**
 * @typedef {Map<number, number>} StateSet
 */

/**
 * @private
 */
export class StateStore {
  constructor (y) {
    this.y = y
    this.state = new Map()
  }
  logTable () {
    const entries = []
    for (let [user, state] of this.state) {
      entries.push({
        user, state
      })
    }
    console.table(entries)
  }
  getNextID (len) {
    const user = this.y.userID
    const state = this.getState(user)
    this.setState(user, state + len)
    return ID.createID(user, state)
  }
  updateRemoteState (struct) {
    let user = struct._id.user
    let userState = this.state.get(user)
    while (struct !== null && struct._id.clock === userState) {
      userState += struct._length
      struct = this.y.os.get(ID.createID(user, userState))
    }
    this.state.set(user, userState)
  }
  getState (user) {
    let state = this.state.get(user)
    if (state == null) {
      return 0
    }
    return state
  }
  setState (user, state) {
    // TODO: modify missingi structs here
    const beforeState = this.y._transaction.beforeState
    if (!beforeState.has(user)) {
      beforeState.set(user, this.getState(user))
    }
    this.state.set(user, state)
  }
}
