
import { getReference } from './structReferences.js'

export default class ID {
  constructor (user, clock) {
    this.user = user
    this.clock = clock
  }
  clone () {
    return new ID(this.user, this.clock)
  }
  equals (id) {
    return id !== null && id.user === this.user && id.clock === this.clock
  }
  lessThan (id) {
    return this.user < id.user || (this.user === id.user && this.clock < id.clock)
  }
}
