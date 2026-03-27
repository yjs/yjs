/** eslint-env browser */

// Order matters: follows internals.js ordering to avoid circular dependency issues

export { IdSet, equalIdSets, createDeleteSetFromStructStore, createInsertSetFromStructStore, diffIdSet, createIdSet, mergeIdSets, insertIntoIdSet, iterateStructsByIdSet, readIdSet, IdMap, createIdMap, createContentAttribute, ContentAttribute, diffIdMap, encodeIdMap, createIdMapFromIdSet, insertIntoIdMap, mergeIdMaps, readIdMap, decodeIdMap, filterIdMap } from './utils/ids.js'
export { Doc } from './utils/Doc.js'
export { UpdateDecoderV1, UpdateDecoderV2 } from './utils/UpdateDecoder.js'
export { UpdateEncoderV1, UpdateEncoderV2 } from './utils/UpdateEncoder.js'
export { applyUpdate, applyUpdateV2, readUpdate, readUpdateV2, encodeStateAsUpdate, encodeStateAsUpdateV2, encodeStateVector, decodeStateVector, diffUpdate, diffUpdateV2, mergeUpdates, mergeUpdatesV2, createDocFromUpdate, createDocFromUpdateV2, cloneDoc } from './utils/encoding.js'
export { ID, createID, compareIDs, findRootTypeKey } from './utils/ID.js'
export { isParentOf } from './utils/isParentOf.js'
export { logType } from './utils/logging.js'
export { createRelativePositionFromTypeIndex, createRelativePositionFromJSON, createAbsolutePositionFromRelativePosition, compareRelativePositions, AbsolutePosition, RelativePosition, relativePositionToJSON, encodeRelativePosition, decodeRelativePosition } from './utils/RelativePosition.js'
export { Snapshot, createSnapshot, snapshot, emptySnapshot, createDocFromSnapshot, decodeSnapshot, encodeSnapshot, decodeSnapshotV2, encodeSnapshotV2, equalSnapshots, snapshotContainsUpdate } from './utils/Snapshot.js'
export { findIndexSS, getItemCleanStart, getItemCleanEnd, tryGc } from './utils/transaction-helpers.js'
export { Transaction, transact, cleanupYTextFormatting } from './utils/Transaction.js'
export { UndoManager, undoContentIds } from './utils/UndoManager.js'
export { logUpdate, logUpdateV2, decodeUpdate, decodeUpdateV2, encodeStateVectorFromUpdate, encodeStateVectorFromUpdateV2, convertUpdateFormatV1ToV2, convertUpdateFormatV2ToV1, obfuscateUpdate, obfuscateUpdateV2, createContentIdsFromUpdate, createContentIdsFromUpdateV2, intersectUpdateWithContentIds, intersectUpdateWithContentIdsV2 } from './utils/updates.js'
export { YEvent, getPathTo } from './utils/YEvent.js'
export { TwosetAttributionManager, noAttributionsManager, AbstractAttributionManager, createAttributionManagerFromDiff, DiffAttributionManager, createAttributionManagerFromSnapshots, SnapshotAttributionManager, Attributions, $attributionManager } from './utils/AttributionManager.js'
export { diffDocsToDelta } from './utils/delta-helpers.js'
export { YType as Type, getTypeChildren, typeMapGetSnapshot, typeMapGetAllSnapshot, $ytype, $ytypeAny } from './ytype.js'
export { AbstractStruct } from './structs/AbstractStruct.js'
export { GC } from './structs/GC.js'
export { Item, ContentBinary, ContentDeleted, ContentDoc, ContentEmbed, ContentFormat, ContentJSON, ContentAny, ContentString, ContentType } from './structs/Item.js'
export { Skip } from './structs/Skip.js'

export * from './utils/meta.js'

const glo = /** @type {any} */ (typeof globalThis !== 'undefined'
  ? globalThis
  : typeof window !== 'undefined'
    ? window
    // @ts-ignore
    : typeof global !== 'undefined' ? global : {})

const importIdentifier = '__ $YJS14$ __'

if (glo[importIdentifier] === true) {
  /**
   * Dear reader of this message. Please take this seriously.
   *
   * If you see this message, make sure that you only import one version of Yjs. In many cases,
   * your package manager installs two versions of Yjs that are used by different packages within your project.
   * Another reason for this message is that some parts of your project use the commonjs version of Yjs
   * and others use the EcmaScript version of Yjs.
   *
   * This often leads to issues that are hard to debug. We often need to perform constructor checks,
   * e.g. `struct instanceof GC`. If you imported different versions of Yjs, it is impossible for us to
   * do the constructor checks anymore - which might break the CRDT algorithm.
   *
   * https://github.com/yjs/yjs/issues/438
   */
  console.error('Yjs was already imported. This breaks constructor checks and will lead to issues! - https://github.com/yjs/yjs/issues/438')
}
glo[importIdentifier] = true
