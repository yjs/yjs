
import {
  isDeleted,
  createDeleteSetFromStructStore,
  getStateVector,
  getItemCleanStart,
  iterateDeletedStructs,
  writeDeleteSet,
  writeStateVector,
  readDeleteSet,
  readStateVector,
  createDeleteSet,
  createID,
  getState,
  Transaction, Doc, DeleteSet, Item // eslint-disable-line
} from '../internals.js'

import * as map from 'lib0/map.js'
import * as set from 'lib0/set.js'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'

export class Snapshot {
  /**
   * @param {DeleteSet} ds
   * @param {Map<number,number>} sv state map
   */
  constructor (ds, sv) {
    /**
     * @type {DeleteSet}
     */
    this.ds = ds
    /**
     * State Map
     * @type {Map<number,number>}
     */
    this.sv = sv
  }
}

/**
 * @param {Snapshot} snap1
 * @param {Snapshot} snap2
 * @return {boolean}
 */
export const equalSnapshots = (snap1, snap2) => {
  const ds1 = snap1.ds.clients
  const ds2 = snap2.ds.clients
  const sv1 = snap1.sv
  const sv2 = snap2.sv
  if (sv1.size !== sv2.size || ds1.size !== ds2.size) {
    return false
  }
  for (const [key, value] of sv1) {
    if (sv2.get(key) !== value) {
      return false
    }
  }
  for (const [client, dsitems1] of ds1) {
    const dsitems2 = ds2.get(client) || []
    if (dsitems1.length !== dsitems2.length) {
      return false
    }
    for (let i = 0; i < dsitems1.length; i++) {
      const dsitem1 = dsitems1[i]
      const dsitem2 = dsitems2[i]
      if (dsitem1.clock !== dsitem2.clock || dsitem1.len !== dsitem2.len) {
        return false
      }
    }
  }
  return true
}

/**
 * @param {Snapshot} snapshot
 * @return {Uint8Array}
 */
export const encodeSnapshot = snapshot => {
  const encoder = encoding.createEncoder()
  writeDeleteSet(encoder, snapshot.ds)
  writeStateVector(encoder, snapshot.sv)
  return encoding.toUint8Array(encoder)
}

/**
 * @param {Uint8Array} buf
 * @return {Snapshot}
 */
export const decodeSnapshot = buf => {
  const decoder = decoding.createDecoder(buf)
  return new Snapshot(readDeleteSet(decoder), readStateVector(decoder))
}

/**
 * @param {DeleteSet} ds
 * @param {Map<number,number>} sm
 * @return {Snapshot}
 */
export const createSnapshot = (ds, sm) => new Snapshot(ds, sm)

export const emptySnapshot = createSnapshot(createDeleteSet(), new Map())

/**
 * @param {Doc} doc
 * @return {Snapshot}
 */
export const snapshot = doc => createSnapshot(createDeleteSetFromStructStore(doc.store), getStateVector(doc.store))

/**
 * @param {Item} item
 * @param {Snapshot|undefined} snapshot
 *
 * @protected
 * @function
 */
export const isVisible = (item, snapshot) => snapshot === undefined ? !item.deleted : (
  snapshot.sv.has(item.id.client) && (snapshot.sv.get(item.id.client) || 0) > item.id.clock && !isDeleted(snapshot.ds, item.id)
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
    snapshot.sv.forEach((clock, client) => {
      if (clock < getState(store, client)) {
        getItemCleanStart(transaction, createID(client, clock))
      }
    })
    iterateDeletedStructs(transaction, snapshot.ds, item => {})
    meta.add(snapshot)
  }
}
