import { DeleteStore } from './DeleteSet'

export class HistorySnapshot {
  /**
   * @param {DeleteStore} ds delete store
   * @param {Map<number,number>} sm state map
   * @param {Map<number,string>} userMap
   */
  constructor (ds, sm, userMap) {
    this.ds = new DeleteStore()
    this.sm = sm
    this.userMap = userMap
  }
}

/**
 * @param {Item} item
 * @param {HistorySnapshot} [snapshot]
 */
export const isVisible = (item, snapshot) => snapshot === undefined ? !item._deleted : (
  snapshot.sm.has(item._id.user) && (snapshot.sm.get(item._id.user) || 0) > item._id.clock && !snapshot.ds.isDeleted(item._id)
)
