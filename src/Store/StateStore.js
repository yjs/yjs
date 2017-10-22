import ID from '../Util/ID.js'

export default class StateStore {
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
    return new ID(user, state)
  }
  updateRemoteState (struct) {
    let user = struct._id.user
    let userState = this.state.get(user)
    while (struct !== null && struct._id.clock === userState) {
      userState += struct._length
      struct = this.y.os.get(new ID(user, userState))
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
    this.state.set(user, state)
  }
}
