
import {
  isDeleted,
  DeleteSet, AbstractItem // eslint-disable-line
} from '../internals.js'

export class Snapshot {
  /**
   * @param {DeleteSet} ds
   * @param {Map<number,number>} sm state map
   */
  constructor (ds, sm) {
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
  }
}

/**
 * @param {DeleteSet} ds
 * @param {Map<number,number>} sm
 */
export const createSnapshot = (ds, sm) => new Snapshot(ds, sm)

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
