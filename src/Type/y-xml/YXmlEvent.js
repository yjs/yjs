
export default class YXmlEvent {
  constructor (target, subs, remote) {
    this.target = target
    this.childListChanged = false
    this.attributesChanged = new Set()
    this.remote = remote
    subs.forEach((sub) => {
      if (sub === null) {
        this.childListChanged = true
      } else {
        this.attributesChanged.add(sub)
      }
    })
  }
}
