import ID from '../Util/ID'

export default class StateStore {
  constructor (y) {
    this.y = y
    this.state = new Map()
    this.currentClock = 0
  }
  getNextID (len) {
    let id = new ID(this.y.userID, this.currentClock)
    this.currentClock += len
    return id
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
}
