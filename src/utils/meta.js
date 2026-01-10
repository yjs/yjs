/**
 * Meta API for describing Yjs documents
 */

import * as idmap from './IdMap.js'
import * as idset from './IdSet.js'
import { IdSetEncoderV2 } from './UpdateEncoder.js'

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
export const createContentIds = (inserts, deletes) => ({ inserts, deletes })

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
export const encodeContentIds = contentIds => writeContentIds(new IdSetEncoderV2(), contentIds)

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
 * @param {ContentMap} contentMap
 */
export const encodeContentMap = contentMap => writeContentMap(new IdSetEncoderV2(), contentMap)
