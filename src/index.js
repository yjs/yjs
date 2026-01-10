/** eslint-env browser */

export {
  Doc,
  Transaction,
  YType as Type,
  YEvent,
  Item,
  AbstractStruct,
  GC,
  Skip,
  ContentBinary,
  ContentDeleted,
  ContentDoc,
  ContentEmbed,
  ContentFormat,
  ContentJSON,
  ContentAny,
  ContentString,
  ContentType,
  getTypeChildren,
  createRelativePositionFromTypeIndex,
  createRelativePositionFromJSON,
  createAbsolutePositionFromRelativePosition,
  compareRelativePositions,
  AbsolutePosition,
  RelativePosition,
  ID,
  createID,
  compareIDs,
  getState,
  Snapshot,
  createSnapshot,
  cleanupYTextFormatting,
  snapshot,
  emptySnapshot,
  findRootTypeKey,
  findIndexSS,
  getItem,
  getItemCleanStart,
  getItemCleanEnd,
  typeMapGetSnapshot,
  typeMapGetAllSnapshot,
  createDocFromSnapshot,
  applyUpdate,
  applyUpdateV2,
  readUpdate,
  readUpdateV2,
  encodeStateAsUpdate,
  encodeStateAsUpdateV2,
  encodeStateVector,
  UndoManager,
  decodeSnapshot,
  encodeSnapshot,
  decodeSnapshotV2,
  encodeSnapshotV2,
  decodeStateVector,
  logUpdate,
  logUpdateV2,
  decodeUpdate,
  decodeUpdateV2,
  relativePositionToJSON,
  isParentOf,
  equalSnapshots,
  tryGc,
  transact,
  logType,
  mergeUpdates,
  mergeUpdatesV2,
  encodeStateVectorFromUpdate,
  encodeStateVectorFromUpdateV2,
  encodeRelativePosition,
  decodeRelativePosition,
  diffUpdate,
  diffUpdateV2,
  convertUpdateFormatV1ToV2,
  convertUpdateFormatV2ToV1,
  obfuscateUpdate,
  obfuscateUpdateV2,
  UpdateEncoderV1,
  UpdateEncoderV2,
  UpdateDecoderV1,
  UpdateDecoderV2,
  snapshotContainsUpdate,
  // idset
  IdSet,
  equalIdSets,
  createDeleteSetFromStructStore,
  IdMap,
  createIdMap,
  createContentAttribute,
  createInsertSetFromStructStore,
  diffIdMap,
  diffIdSet,
  ContentAttribute,
  encodeIdMap,
  createIdMapFromIdSet,
  TwosetAttributionManager,
  noAttributionsManager,
  AbstractAttributionManager,
  iterateStructsByIdSet,
  createAttributionManagerFromDiff,
  DiffAttributionManager,
  createAttributionManagerFromSnapshots,
  SnapshotAttributionManager,
  createIdSet,
  mergeIdSets,
  cloneDoc,
  readUpdateToContentIds,
  readUpdateToContentIdsV2,
  insertIntoIdMap,
  insertIntoIdSet,
  mergeIdMaps,
  readIdMap,
  readIdSet,
  decodeIdMap,
  diffDocsToDelta,
  getPathTo,
  Attributions,
  filterIdMap,
  undoContentIds,
  createContentIds,
  createContentMap,
  createContentIdsFromContentMap,
  createContentMapFromContentIds
} from './internals.js'

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
