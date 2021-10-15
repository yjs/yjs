/** eslint-env browser */

export {
  Doc,
  Transaction,
  YArray as Array,
  YMap as Map,
  YText as Text,
  YXmlText as XmlText,
  YXmlHook as XmlHook,
  YXmlElement as XmlElement,
  YXmlFragment as XmlFragment,
  YXmlEvent,
  YMapEvent,
  YArrayEvent,
  YTextEvent,
  YEvent,
  Item,
  AbstractStruct,
  GC,
  ContentBinary,
  ContentDeleted,
  ContentEmbed,
  ContentFormat,
  ContentJSON,
  ContentAny,
  ContentString,
  ContentType,
  AbstractType,
  RelativePosition,
  getTypeChildren,
  createRelativePositionFromTypeIndex,
  createRelativePositionFromJSON,
  createAbsolutePositionFromRelativePosition,
  compareRelativePositions,
  ID,
  createID,
  compareIDs,
  getState,
  Snapshot,
  createSnapshot,
  createDeleteSet,
  createDeleteSetFromStructStore,
  snapshot,
  emptySnapshot,
  findRootTypeKey,
  findIndexSS,
  getItem,
  typeListToArraySnapshot,
  typeMapGetSnapshot,
  createDocFromSnapshot,
  iterateDeletedStructs,
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
  relativePositionToJSON,
  isDeleted,
  isParentOf,
  equalSnapshots,
  PermanentUserData, // @TODO experimental
  tryGc,
  transact,
  AbstractConnector,
  logType,
  mergeUpdates,
  mergeUpdatesV2,
  parseUpdateMeta,
  parseUpdateMetaV2,
  encodeStateVectorFromUpdate,
  encodeStateVectorFromUpdateV2,
  encodeRelativePosition,
  decodeRelativePosition,
  diffUpdate,
  diffUpdateV2
} from './internals.js'

const glo = /** @type {any} */ (typeof window !== 'undefined'
  ? window
  : typeof global !== 'undefined' ? global : {})
const importIdentifier = '__ $YJS$ __'

if (glo[importIdentifier] === true) {
  /**
   * Dear reader of this warning message. Please take this seriously.
   *
   * If you see this message, please make sure that you only import one version of Yjs. In many cases,
   * your package manager installs two versions of Yjs that are used by different packages within your project.
   * Another reason for this message is that some parts of your project use the commonjs version of Yjs
   * and others use the EcmaScript version of Yjs.
   *
   * This often leads to issues that are hard to debug. We often need to perform constructor checks,
   * e.g. `struct instanceof GC`. If you imported different versions of Yjs, it is impossible for us to
   * do the constructor checks anymore - which might break the CRDT algorithm.
   */
  console.warn('Yjs was already imported. Importing different versions of Yjs often leads to issues.')
}
glo[importIdentifier] = true
