import { getStructReference } from '../structReferences.js'

export const RootFakeUserID = 0xFFFFFF

export default class RootID {
  constructor (name, typeConstructor) {
    this.user = RootFakeUserID
    this.name = name
    this.type = getStructReference(typeConstructor)
  }
  equals (id) {
    return id !== null && id.user === this.user && id.name === this.name && id.type === this.type
  }
  lessThan (id) {
    if (id.constructor === RootID) {
      return this.user < id.user || (this.user === id.user && (this.name < id.name || (this.name === id.name && this.type < id.type)))
    } else {
      return true
    }
  }
}
