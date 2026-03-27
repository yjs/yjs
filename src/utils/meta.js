/**
 * Meta API for describing Yjs documents
 */

import * as decoding from 'lib0/decoding'

import * as ids from './ids.js'
import { IdSetEncoderV2 } from './UpdateEncoder.js'
import { IdSetDecoderV2 } from './UpdateDecoder.js'

/**
 * @typedef {{ inserts: IdSet, deletes: IdSet }} ContentIds
 */

/**
 * @typedef {{ inserts: IdMap<any>, deletes: IdMap<any> }} ContentMap
 */

/**
 * @param {IdSet} inserts
 * @param {IdSet} deletes
 */
export const createContentIds = (inserts = ids.createIdSet(), deletes = ids.createIdSet()) => ({ inserts, deletes })

/**
 * @param {ContentMap} contentMap
 */
export const createContentIdsFromContentMap = contentMap => createContentIds(
  ids.createIdSetFromIdMap(contentMap.inserts),
  ids.createIdSetFromIdMap(contentMap.deletes)
)

/**
 * @param {import('./Doc.js').Doc} ydoc
 */
export const createContentIdsFromDoc = ydoc => createContentIds(
  ids.createInsertSetFromStructStore(ydoc.store, false),
  ids.createDeleteSetFromStructStore(ydoc.store)
)

/**
 * @param {import('./Doc.js').Doc} ydocPrev
 * @param {import('./Doc.js').Doc} ydocNext
 */
export const createContentIdsFromDocDiff = (ydocPrev, ydocNext) =>
  excludeContentIds(createContentIdsFromDoc(ydocPrev), createContentIdsFromDoc(ydocNext))

/**
 * @param {ContentIds} content
 * @param {ContentIds} excludeContent
 */
export const excludeContentIds = (content, excludeContent) =>
  createContentIds(ids.diffIdSet(content.inserts, excludeContent.inserts), ids.diffIdSet(content.deletes, excludeContent.deletes))

/**
 * @param {ContentMap} content
 * @param {ContentIds | ContentMap} excludeContent
 */
export const excludeContentMap = (content, excludeContent) => createContentMap(
  ids.diffIdMap(content.inserts, excludeContent.inserts),
  ids.diffIdMap(content.deletes, excludeContent.deletes)
)

/**
 * @param {Array<ContentMap>} contents
 */
export const mergeContentMaps = contents => createContentMap(
  ids.mergeIdMaps(contents.map(c => c.inserts)),
  ids.mergeIdMaps(contents.map(c => c.deletes))
)

/**
 * @param {Array<ContentIds>} contents
 */
export const mergeContentIds = contents => createContentIds(
  ids.mergeIdSets(contents.map(c => c.inserts)),
  ids.mergeIdSets(contents.map(c => c.deletes))
)

/**
 * @param {IdMap<any>} inserts
 * @param {IdMap<any>} deletes
 */
export const createContentMap = (inserts, deletes) => ({ inserts, deletes })

/**
 * @param {ContentIds} contentIds
 * @param {Array<ContentAttribute<any>>} insertAttrs
 * @param {Array<ContentAttribute<any>>} [deleteAttrs]
 */
export const createContentMapFromContentIds = (contentIds, insertAttrs, deleteAttrs = insertAttrs) => createContentMap(
  ids.createIdMapFromIdSet(contentIds.inserts, insertAttrs),
  ids.createIdMapFromIdSet(contentIds.deletes, deleteAttrs)
)

/**
 * @param {import('./UpdateEncoder.js').IdSetEncoder} encoder
 * @param {ContentIds} contentIds
 */
export const writeContentIds = (encoder, contentIds) => {
  ids.writeIdSet(encoder, contentIds.inserts)
  ids.writeIdSet(encoder, contentIds.deletes)
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
  ids.readIdSet(decoder),
  ids.readIdSet(decoder)
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
  ids.writeIdMap(encoder, contentMap.inserts)
  ids.writeIdMap(encoder, contentMap.deletes)
}

/**
 * @todo this encoding needs to be heavily optimized for production
 *
 * @param {import('./UpdateDecoder.js').IdSetDecoder} decoder
 * @return {ContentMap} contentMap
 */
export const readContentMap = (decoder) => createContentMap(
  ids.readIdMap(decoder),
  ids.readIdMap(decoder)
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
  ids.intersectMaps(mapA.inserts, mapB.inserts),
  ids.intersectMaps(mapA.deletes, mapB.deletes)
)

/**
 * @param {ContentIds} setA
 * @param {ContentIds|ContentMap} setB
 */
export const intersectContentIds = (setA, setB) => createContentIds(
  ids.intersectSets(setA.inserts, setB.inserts),
  ids.intersectSets(setA.deletes, setB.deletes)
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
export const filterContentMap = (contentMap, insertPredicate, deletePredicate) => createContentMap(ids.filterIdMap(contentMap.inserts, insertPredicate), ids.filterIdMap(contentMap.deletes, deletePredicate))
