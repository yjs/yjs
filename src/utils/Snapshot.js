import { DeleteSet, isDeleted } from './DeleteSet'
import { AbstractItem } from '../structs/AbstractItem.js' // eslint-disable-line

export class Snapshot {
  /**
   * @param {DeleteSet} ds delete store
   * @param {Map<number,number>} sm state map
   * @param {Map<number,string>} userMap
   */
  constructor (ds, sm, userMap) {
    this.ds = new DeleteSet()
    this.sm = sm
    this.userMap = userMap
  }
}

/**
 * @param {AbstractItem} item
 * @param {Snapshot} [snapshot]
 */
export const isVisible = (item, snapshot) => snapshot === undefined ? !item.deleted : (
  snapshot.sm.has(item.id.client) && (snapshot.sm.get(item.id.client) || 0) > item.id.clock && !isDeleted(snapshot.ds, item.id)
)
