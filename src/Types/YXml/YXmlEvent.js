import YEvent from '../../Util/YEvent.js'

/**
 * An Event that describes changes on a YXml Element or Yxml Fragment
 */
export default class YXmlEvent extends YEvent {
  constructor (target, subs, remote, transaction) {
    super(target)
    this._transaction = transaction
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
