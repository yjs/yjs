import {
  createDeleteSetFromStructStore,
  getStateVector,
  getItemCleanStart,
  iterateStructsByIdSet,
  writeIdSet,
  writeStateVector,
  readIdSet,
  readStateVector,
  createIdSet,
  createID,
  getState,
  findIndexSS,
  UpdateEncoderV2,
  applyUpdateV2,
  LazyStructReader,
  equalIdSets,
  UpdateDecoderV1, UpdateDecoderV2, IdSetEncoderV1, IdSetEncoderV2, DSDecoderV1, DSDecoderV2, Transaction, Doc, IdSet, Item, // eslint-disable-line
  mergeIdSets
} from '../internals.js'

import * as map from 'lib0/map'
import * as set from 'lib0/set'
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'

export class Snapshot {
  /**
   * @param {IdSet} ds
   * @param {Map<number,number>} sv state map
   */
  constructor (ds, sv) {
    /**
     * @type {IdSet}
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
  const sv1 = snap1.sv
  const sv2 = snap2.sv
  if (sv1.size !== sv2.size) {
    return false
  }
  for (const [key, value] of sv1.entries()) {
    if (sv2.get(key) !== value) {
      return false
    }
  }
  return equalIdSets(snap1.ds, snap2.ds)
}

/**
 * @param {Snapshot} snapshot
 * @param {IdSetEncoderV1 | IdSetEncoderV2} [encoder]
 * @return {Uint8Array}
 */
export const encodeSnapshotV2 = (snapshot, encoder = new IdSetEncoderV2()) => {
  writeIdSet(encoder, snapshot.ds)
  writeStateVector(encoder, snapshot.sv)
  return encoder.toUint8Array()
}

/**
 * @param {Snapshot} snapshot
 * @return {Uint8Array}
 */
export const encodeSnapshot = snapshot => encodeSnapshotV2(snapshot, new IdSetEncoderV1())

/**
 * @param {Uint8Array} buf
 * @param {DSDecoderV1 | DSDecoderV2} [decoder]
 * @return {Snapshot}
 */
export const decodeSnapshotV2 = (buf, decoder = new DSDecoderV2(decoding.createDecoder(buf))) => {
  return new Snapshot(readIdSet(decoder), readStateVector(decoder))
}

/**
 * @param {Uint8Array} buf
 * @return {Snapshot}
 */
export const decodeSnapshot = buf => decodeSnapshotV2(buf, new DSDecoderV1(decoding.createDecoder(buf)))

/**
 * @param {IdSet} ds
 * @param {Map<number,number>} sm
 * @return {Snapshot}
 */
export const createSnapshot = (ds, sm) => new Snapshot(ds, sm)

export const emptySnapshot = createSnapshot(createIdSet(), new Map())

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
export const isVisible = (item, snapshot) => snapshot === undefined
  ? !item.deleted
  : snapshot.sv.has(item.id.client) && (snapshot.sv.get(item.id.client) || 0) > item.id.clock && !snapshot.ds.has(item.id)

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
    iterateStructsByIdSet(transaction, snapshot.ds, _item => {})
    meta.add(snapshot)
  }
}

/**
 * @example
 *  const ydoc = new Y.Doc({ gc: false })
 *  ydoc.getText().insert(0, 'world!')
 *  const snapshot = Y.snapshot(ydoc)
 *  ydoc.getText().insert(0, 'hello ')
 *  const restored = Y.createDocFromSnapshot(ydoc, snapshot)
 *  assert(restored.getText().toString() === 'world!')
 *
 * @param {Doc} originDoc
 * @param {Snapshot} snapshot
 * @param {Doc} [newDoc] Optionally, you may define the Yjs document that receives the data from originDoc
 * @return {Doc}
 */
export const createDocFromSnapshot = (originDoc, snapshot, newDoc = new Doc()) => {
  if (originDoc.gc) {
    // we should not try to restore a GC-ed document, because some of the restored items might have their content deleted
    throw new Error('Garbage-collection must be disabled in `originDoc`!')
  }
  const { sv, ds } = snapshot

  const encoder = new UpdateEncoderV2()
  originDoc.transact(transaction => {
    let size = 0
    sv.forEach(clock => {
      if (clock > 0) {
        size++
      }
    })
    encoding.writeVarUint(encoder.restEncoder, size)
    // splitting the structs before writing them to the encoder
    for (const [client, clock] of sv) {
      if (clock === 0) {
        continue
      }
      if (clock < getState(originDoc.store, client)) {
        getItemCleanStart(transaction, createID(client, clock))
      }
      const structs = originDoc.store.clients.get(client) || []
      const lastStructIndex = findIndexSS(structs, clock - 1)
      // write # encoded structs
      encoding.writeVarUint(encoder.restEncoder, lastStructIndex + 1)
      encoder.writeClient(client)
      // first clock written is 0
      encoding.writeVarUint(encoder.restEncoder, 0)
      for (let i = 0; i <= lastStructIndex; i++) {
        structs[i].write(encoder, 0)
      }
    }
    writeIdSet(encoder, ds)
  })

  applyUpdateV2(newDoc, encoder.toUint8Array(), 'snapshot')
  return newDoc
}

/**
 * @param {Snapshot} snapshot
 * @param {Uint8Array} update
 * @param {typeof UpdateDecoderV2 | typeof UpdateDecoderV1} [YDecoder]
 */
export const snapshotContainsUpdateV2 = (snapshot, update, YDecoder = UpdateDecoderV2) => {
  const structs = []
  const updateDecoder = new YDecoder(decoding.createDecoder(update))
  const lazyDecoder = new LazyStructReader(updateDecoder, false)
  for (let curr = lazyDecoder.curr; curr !== null; curr = lazyDecoder.next()) {
    structs.push(curr)
    if ((snapshot.sv.get(curr.id.client) || 0) < curr.id.clock + curr.length) {
      return false
    }
  }
  const mergedDS = mergeIdSets([snapshot.ds, readIdSet(updateDecoder)])
  return equalIdSets(snapshot.ds, mergedDS)
}

/**
 * @param {Snapshot} snapshot
 * @param {Uint8Array} update
 */
export const snapshotContainsUpdate = (snapshot, update) => snapshotContainsUpdateV2(snapshot, update, UpdateDecoderV1)
