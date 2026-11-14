/**
 * Meta API for describing Yjs documents
 */

import * as decoding from 'lib0/decoding'
import * as s from 'lib0/schema'

import {
  $idSet,
  $idMapAny,
  createIdSetFromIdMap,
  createDeleteSetFromStructStore,
  createInsertSetFromStructStore,
  diffIdMap,
  mergeIdMaps,
  createIdSet,
  createIdMap,
  mergeIdSets,
  diffIdSet,
  createIdMapFromIdSet,
  writeIdSet,
  readIdSet,
  writeIdMap,
  readIdMap,
  intersectMaps,
  intersectSets,
  filterIdMap,
  equalIdSets
} from './ids.js'
import { IdSetEncoderV2 } from './UpdateEncoder.js'
import { IdSetDecoderV2 } from './UpdateDecoder.js'

/**
 * @param {IdSet} inserts
 * @param {IdSet} deletes
 * @return {ContentIds}
 */
export const createContentIds = (inserts = createIdSet(), deletes = createIdSet()) => ({ inserts, deletes })

/**
 * @param {ContentIds} a
 * @param {ContentIds} b
 */
export const equalContentIds = (a, b) => equalIdSets(a.inserts, b.inserts) && equalIdSets(a.deletes, b.deletes)

/**
 * @param {ContentMap} contentMap
 */
export const createContentIdsFromContentMap = contentMap => createContentIds(
  createIdSetFromIdMap(contentMap.inserts),
  createIdSetFromIdMap(contentMap.deletes)
)

/**
 * @param {import('./Doc.js').Doc} ydoc
 * @param {boolean} insertsContainDeletes - whether the returned `inserts` set includes content that
 * the doc has already deleted. `true` yields a full structural snapshot (every inserted id);
 * `false` yields only the doc's currently-visible content (`inserts − deletes`), which is what you
 * want when the snapshot defines what should render.
 */
export const createContentIdsFromDoc = (ydoc, insertsContainDeletes) => createContentIds(
  createInsertSetFromStructStore(ydoc.store, !insertsContainDeletes),
  createDeleteSetFromStructStore(ydoc.store)
)

/**
 * Converts a (deprecated) v13 `Snapshot` — a state vector plus a delete set — into the ContentIds
 * it describes, so stored snapshots keep working with the ContentIds API. For a doc without gaps,
 * `createContentIdsFromSnapshot(snapshot(doc), x)` equals `createContentIdsFromDoc(doc, x)`.
 *
 * @param {Snapshot} snapshot
 * @param {boolean} insertsContainDeletes - as in {@link createContentIdsFromDoc}: `true` yields
 * every id the snapshot contains (`[0, clock)` per client of its state vector), `false` only the
 * content visible in it (`inserts − deletes`).
 */
export const createContentIdsFromSnapshot = (snapshot, insertsContainDeletes) => {
  const inserts = createIdSet()
  snapshot.sv.forEach((clock, client) => {
    if (clock > 0) inserts.add(client, 0, clock)
  })
  return createContentIds(insertsContainDeletes ? inserts : diffIdSet(inserts, snapshot.ds), snapshot.ds)
}

/**
 * @param {import('./Doc.js').Doc} ydocPrev
 * @param {import('./Doc.js').Doc} ydocNext
 */
export const createContentIdsFromDocDiff = (ydocPrev, ydocNext) =>
  excludeContentIds(createContentIdsFromDoc(ydocPrev, true), createContentIdsFromDoc(ydocNext, true))

/**
 * @param {ContentIds} content
 * @param {ContentIds} excludeContent
 */
export const excludeContentIds = (content, excludeContent) =>
  createContentIds(diffIdSet(content.inserts, excludeContent.inserts), diffIdSet(content.deletes, excludeContent.deletes))

/**
 * @param {ContentMap} content
 * @param {ContentIds | ContentMap} excludeContent
 */
export const excludeContentMap = (content, excludeContent) => createContentMap(
  diffIdMap(content.inserts, excludeContent.inserts),
  diffIdMap(content.deletes, excludeContent.deletes)
)

/**
 * @param {Array<ContentMap>} contents
 */
export const mergeContentMaps = contents => createContentMap(
  mergeIdMaps(contents.map(c => c.inserts)),
  mergeIdMaps(contents.map(c => c.deletes))
)

/**
 * @param {Array<ContentIds>} contents
 */
export const mergeContentIds = contents => createContentIds(
  mergeIdSets(contents.map(c => c.inserts)),
  mergeIdSets(contents.map(c => c.deletes))
)

/**
 * @param {IdMap<any>} [inserts]
 * @param {IdMap<any>} [deletes]
 * @return {ContentMap}
 */
export const createContentMap = (inserts = createIdMap(), deletes = createIdMap()) => ({ inserts, deletes })

/**
 * @param {ContentIds} contentIds
 * @param {Array<ContentAttribute<any>>} insertAttrs
 * @param {Array<ContentAttribute<any>>} [deleteAttrs]
 */
export const createContentMapFromContentIds = (contentIds, insertAttrs, deleteAttrs = insertAttrs) => createContentMap(
  createIdMapFromIdSet(contentIds.inserts, insertAttrs),
  createIdMapFromIdSet(contentIds.deletes, deleteAttrs)
)

/**
 * @param {import('./UpdateEncoder.js').IdSetEncoder} encoder
 * @param {ContentIds} contentIds
 */
export const writeContentIds = (encoder, contentIds) => {
  writeIdSet(encoder, contentIds.inserts)
  writeIdSet(encoder, contentIds.deletes)
}

/**
 * @param {ContentIds} contentIds
 */
export const encodeContentIds = contentIds => {
  const encoder = new IdSetEncoderV2()
  writeContentIds(encoder, contentIds)
  return encoder.toUint8Array()
}

/**
 * @todo this encoding needs to be heavily optimized for production
 *
 * @param {import('./UpdateDecoder.js').IdSetDecoder} decoder
 * @return {ContentIds}
 */
export const readContentIds = decoder => createContentIds(
  readIdSet(decoder),
  readIdSet(decoder)
)

/**
 * @param {Uint8Array<any>} buf
 */
export const decodeContentIds = buf => readContentIds(new IdSetDecoderV2(decoding.createDecoder(buf)))

/**
 * @todo this encoding needs to be heavily optimized for production
 *
 * @param {import('./UpdateEncoder.js').IdSetEncoder} encoder
 * @param {ContentMap} contentMap
 */
export const writeContentMap = (encoder, contentMap) => {
  writeIdMap(encoder, contentMap.inserts)
  writeIdMap(encoder, contentMap.deletes)
}

/**
 * @todo this encoding needs to be heavily optimized for production
 *
 * @param {import('./UpdateDecoder.js').IdSetDecoder} decoder
 * @return {ContentMap} contentMap
 */
export const readContentMap = (decoder) => createContentMap(
  readIdMap(decoder),
  readIdMap(decoder)
)

/**
 * @param {ContentMap} contentMap
 */
export const encodeContentMap = contentMap => {
  const encoder = new IdSetEncoderV2()
  writeContentMap(encoder, contentMap)
  return encoder.toUint8Array()
}

/**
 * @param {ContentMap} mapA
 * @param {ContentMap|ContentIds} mapB
 */
export const intersectContentMap = (mapA, mapB) => createContentMap(
  intersectMaps(mapA.inserts, mapB.inserts),
  intersectMaps(mapA.deletes, mapB.deletes)
)

/**
 * @param {ContentIds} setA
 * @param {ContentIds|ContentMap} setB
 */
export const intersectContentIds = (setA, setB) => createContentIds(
  intersectSets(setA.inserts, setB.inserts),
  intersectSets(setA.deletes, setB.deletes)
)

/**
 * @param {Uint8Array<any>} buf
 */
export const decodeContentMap = buf => readContentMap(new IdSetDecoderV2(decoding.createDecoder(buf)))

/**
 * @todo filter by array of content instead
 * @param {ContentMap} contentMap
 * @param {(c:Array<ContentAttribute<any>>)=>boolean} insertPredicate
 * @param {(c:Array<ContentAttribute<any>>)=>boolean} deletePredicate
 */
export const filterContentMap = (contentMap, insertPredicate, deletePredicate) => createContentMap(filterIdMap(contentMap.inserts, insertPredicate), filterIdMap(contentMap.deletes, deletePredicate))

/**
 * Schema of {@link ContentIds} - the shape produced by {@link createContentIds}.
 *
 * Structural: a `ContentIds` is a plain object literal, so there is no prototype to tag. The
 * *nominal* {@link $idSet} checks on the two fields are what discriminate it from a
 * {@link ContentMap} in both directions.
 *
 * @type {s.Schema<ContentIds>}
 */
export const $contentIds = s.$object({ inserts: $idSet, deletes: $idSet })

/**
 * Schema of {@link ContentMap} - the shape produced by {@link createContentMap}.
 *
 * See {@link $contentIds}. Use {@link $idMap} on the individual fields to additionally constrain
 * the mapped-value type; `ContentMap` itself hardcodes `IdMap<any>`.
 *
 * @type {s.Schema<ContentMap>}
 */
export const $contentMap = s.$object({ inserts: $idMapAny, deletes: $idMapAny })
