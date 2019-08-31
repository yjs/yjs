
import {
  isDeleted,
  createDeleteSetFromStructStore,
  getStateVector,
  getItemCleanStart,
  createID,
  iterateDeletedStructs,
  Transaction, Doc, DeleteSet, Item // eslint-disable-line
} from '../internals.js'

import * as map from 'lib0/map.js'
import * as set from 'lib0/set.js'

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
 * @return {Snapshot}
 */
export const createSnapshot = (ds, sm) => new Snapshot(ds, sm)

/**
 * @param {Doc} doc
 * @return {Snapshot}
 */
export const createSnapshotFromDoc = doc => createSnapshot(createDeleteSetFromStructStore(doc.store), getStateVector(doc.store))

/**
 * @param {Item} item
 * @param {Snapshot|undefined} snapshot
 *
 * @protected
 * @function
 */
export const isVisible = (item, snapshot) => snapshot === undefined ? !item.deleted : (
  snapshot.sm.has(item.id.client) && (snapshot.sm.get(item.id.client) || 0) > item.id.clock && !isDeleted(snapshot.ds, item.id)
)

/**
 * @param {Transaction} transaction
 * @param {Snapshot} snapshot
 */
export const splitSnapshotAffectedStructs = (transaction, snapshot) => {
  const meta = map.setIfUndefined(transaction.meta, splitSnapshotAffectedStructs, set.create)
  const store = transaction.doc.store
  // check if we already split for this snapshot
  if (!meta.has(snapshot)) {
    snapshot.sm.forEach((clock, client) => {
      getItemCleanStart(transaction, store, createID(client, clock))
    })
    iterateDeletedStructs(transaction, snapshot.ds, store, item => {})
    meta.add(snapshot)
  }
}
