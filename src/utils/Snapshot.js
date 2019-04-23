
import {
  isDeleted,
  DeleteSet, AbstractItem // eslint-disable-line
} from '../internals.js'

export class Snapshot {
  /**
   * @param {DeleteSet} ds delete store
   * @param {Map<number,number>} sm state map
   * @param {Map<number,string>} userMap
   * @private
   */
  constructor (ds, sm, userMap) {
    /**
     * @type {DeleteSet}
     * @private
     */
    this.ds = ds
    /**
     * State Map
     * @type {Map<number,number>}
     * @private
     */
    this.sm = sm
    /**
     * @type {Map<number,string>}
     * @private
     */
    this.userMap = userMap
  }
}

/**
 * @param {AbstractItem} item
 * @param {Snapshot|undefined} snapshot
 *
 * @protected
 * @function
 */
export const isVisible = (item, snapshot) => snapshot === undefined ? !item.deleted : (
  snapshot.sm.has(item.id.client) && (snapshot.sm.get(item.id.client) || 0) > item.id.clock && !isDeleted(snapshot.ds, item.id)
)
