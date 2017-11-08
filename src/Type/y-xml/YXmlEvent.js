import YEvent from '../../Util/YEvent.js'

export default class YXmlEvent extends YEvent {
  constructor (target, subs, remote) {
    super(target)
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
