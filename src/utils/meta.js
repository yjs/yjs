/**
 * Meta API for describing Yjs documents
 */

import * as idmap from './IdMap.js'
import * as idset from './IdSet.js'
import { IdSetEncoderV2 } from './UpdateEncoder.js'
import { IdSetDecoderV2 } from './UpdateDecoder.js'
import * as decoding from 'lib0/decoding'

/**
 * @typedef {{ inserts: import('./IdSet.js').IdSet, deletes: import('./IdSet.js').IdSet }} ContentIds
 */

/**
 * @typedef {{ inserts: import('./IdMap.js').IdMap<any>, deletes: import('./IdMap.js').IdMap<any> }} ContentMap
 */

/**
 * @param {import('./IdSet.js').IdSet} inserts
 * @param {import('./IdSet.js').IdSet} deletes
 */
export const createContentIds = (inserts = idset.createIdSet(), deletes = idset.createIdSet()) => ({ inserts, deletes })

/**
 * @param {ContentMap} contentMap
 */
export const createContentIdsFromContentMap = contentMap => createContentIds(
  idmap.createIdSetFromIdMap(contentMap.inserts),
  idmap.createIdSetFromIdMap(contentMap.deletes)
)

/**
 * @param {import('./Doc.js').Doc} ydoc
 */
export const createContentIdsFromDoc = ydoc => createContentIds(
  idset.createInsertSetFromStructStore(ydoc.store, false),
  idset.createDeleteSetFromStructStore(ydoc.store)
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
  createContentIds(idset.diffIdSet(content.inserts, excludeContent.inserts), idset.diffIdSet(content.deletes, excludeContent.deletes))

/**
 * @param {ContentMap} content
 * @param {ContentIds | ContentMap} excludeContent
 */
export const excludeContentMaps = (content, excludeContent) => createContentMap(
  idmap.diffIdMap(content.inserts, excludeContent.inserts),
  idmap.diffIdMap(content.deletes, excludeContent.deletes)
)

/**
 * @param {Array<ContentMap>} contents
 */
export const mergeContentMaps = contents => createContentMap(
  idmap.mergeIdMaps(contents.map(c => c.inserts)),
  idmap.mergeIdMaps(contents.map(c => c.deletes))
)

/**
 * @param {Array<ContentIds>} contents
 */
export const mergeContentIds = contents => createContentIds(
  idset.mergeIdSets(contents.map(c => c.inserts)),
  idset.mergeIdSets(contents.map(c => c.deletes))
)

/**
 * @param {import('./IdMap.js').IdMap<any>} inserts
 * @param {import('./IdMap.js').IdMap<any>} deletes
 */
export const createContentMap = (inserts, deletes) => ({ inserts, deletes })

/**
 * @param {ContentIds} contentIds
 * @param {Array<idmap.ContentAttribute<any>>} insertAttrs
 * @param {Array<idmap.ContentAttribute<any>>} [deleteAttrs]
 */
export const createContentMapFromContentIds = (contentIds, insertAttrs, deleteAttrs = insertAttrs) => createContentMap(
  idmap.createIdMapFromIdSet(contentIds.inserts, insertAttrs),
  idmap.createIdMapFromIdSet(contentIds.deletes, deleteAttrs)
)

/**
 * @param {import('./UpdateEncoder.js').IdSetEncoder} encoder
 * @param {ContentIds} contentIds
 */
export const writeContentIds = (encoder, contentIds) => {
  idset.writeIdSet(encoder, contentIds.inserts)
  idset.writeIdSet(encoder, contentIds.deletes)
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
  idset.readIdSet(decoder),
  idset.readIdSet(decoder)
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
  idmap.writeIdMap(encoder, contentMap.inserts)
  idmap.writeIdMap(encoder, contentMap.deletes)
}

/**
 * @todo this encoding needs to be heavily optimized for production
 *
 * @param {import('./UpdateDecoder.js').IdSetDecoder} decoder
 * @return {ContentMap} contentMap
 */
export const readContentMap = (decoder) => createContentMap(
  idmap.readIdMap(decoder),
  idmap.readIdMap(decoder)
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
  idmap.intersectMaps(mapA.inserts, mapB.inserts),
  idmap.intersectMaps(mapA.deletes, mapB.deletes)
)

/**
 * @param {ContentIds} setA
 * @param {ContentIds|ContentMap} setB
 */
export const intersectContentIds = (setA, setB) => createContentIds(
  idset.intersectSets(setA.inserts, setB.inserts),
  idset.intersectSets(setA.deletes, setB.deletes)
)

/**
 * @param {Uint8Array<any>} buf
 */
export const decodeContentMap = buf => readContentMap(new IdSetDecoderV2(decoding.createDecoder(buf)))

/**
 * @todo filter by array of content instead
 * @param {ContentMap} contentMap
 * @param {(c:Array<idmap.ContentAttribute<any>>)=>boolean} insertPredicate
 * @param {(c:Array<idmap.ContentAttribute<any>>)=>boolean} deletePredicate
 */
export const filterContentMap = (contentMap, insertPredicate, deletePredicate) => createContentMap(idmap.filterIdMap(contentMap.inserts, insertPredicate), idmap.filterIdMap(contentMap.deletes, deletePredicate))

