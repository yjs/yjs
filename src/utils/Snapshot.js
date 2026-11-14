/**
 * The v13 snapshot format: a state vector plus a delete set. Kept so stored snapshots can still be
 * decoded, compared and converted (`createContentIdsFromSnapshot`). Reading or restoring content as
 * of a point in time moved to `ContentIds` (`./meta.js`): `createContentIdsFromDoc` captures one,
 * `intersectUpdateWithContentIds` (`./updates.js`) restores it, and an `AttributionsRenderer` with
 * `renderedContent` renders the past state in place.
 */

import * as decoding from 'lib0/decoding'

import { createDeleteSetFromStructStore, createIdSet, equalIdSets, writeIdSet, readIdSet } from './ids.js'
import { getStateVector } from './StructStore.js'
import { writeStateVector, readStateVector } from './encoding.js'
import { IdSetDecoderV1, IdSetDecoderV2 } from './UpdateDecoder.js'
import { IdSetEncoderV1, IdSetEncoderV2 } from './UpdateEncoder.js'

/**
 * @deprecated use ContentIds instead (createContentIdsFromDoc; createContentIdsFromSnapshot converts a stored snapshot)
 */
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
 * @deprecated use equalContentIds instead
 *
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
 * @deprecated use encodeContentIds instead (not wire compatible)
 *
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
 * @deprecated use encodeContentIds instead (not wire compatible)
 *
 * @param {Snapshot} snapshot
 * @return {Uint8Array}
 */
export const encodeSnapshot = snapshot => encodeSnapshotV2(snapshot, new IdSetEncoderV1())

/**
 * @deprecated use decodeContentIds instead (not wire compatible)
 *
 * @param {Uint8Array} buf
 * @param {IdSetDecoderV1 | IdSetDecoderV2} [decoder]
 * @return {Snapshot}
 */
export const decodeSnapshotV2 = (buf, decoder = new IdSetDecoderV2(decoding.createDecoder(buf))) => {
  return new Snapshot(readIdSet(decoder), readStateVector(decoder))
}

/**
 * @deprecated use decodeContentIds instead (not wire compatible)
 *
 * @param {Uint8Array} buf
 * @return {Snapshot}
 */
export const decodeSnapshot = buf => decodeSnapshotV2(buf, new IdSetDecoderV1(decoding.createDecoder(buf)))

/**
 * @deprecated use createContentIds instead
 *
 * @param {IdSet} ds
 * @param {Map<number,number>} sm
 * @return {Snapshot}
 */
export const createSnapshot = (ds, sm) => new Snapshot(ds, sm)

/**
 * @deprecated use createContentIds() instead
 */
export const emptySnapshot = createSnapshot(createIdSet(), new Map())

/**
 * @deprecated use createContentIdsFromDoc(doc, true) instead
 *
 * @param {Doc} doc
 * @return {Snapshot}
 */
export const snapshot = doc => createSnapshot(createDeleteSetFromStructStore(doc.store), getStateVector(doc.store))
