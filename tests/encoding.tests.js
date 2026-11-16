import * as t from 'lib0/testing'

import {
  contentRefs,
  readContentDeleted,
  readContentBinary,
  readContentString,
  readContentJSON,
  readContentEmbed,
  readContentType,
  readContentFormat,
  readContentAny,
  readContentDoc
} from '../src/ynode.js'

import * as Y from '../src/index.js'
import * as encoding from 'lib0/encoding'

/**
 * @param {t.TestCase} _tc
 */
export const testStructReferences = _tc => {
  t.assert(contentRefs.length === 11)
  t.assert(contentRefs[1] === readContentDeleted)
  t.assert(contentRefs[2] === readContentJSON) // TODO: deprecate content json?
  t.assert(contentRefs[3] === readContentBinary)
  t.assert(contentRefs[4] === readContentString)
  t.assert(contentRefs[5] === readContentEmbed)
  t.assert(contentRefs[6] === readContentFormat)
  t.assert(contentRefs[7] === readContentType)
  t.assert(contentRefs[8] === readContentAny)
  t.assert(contentRefs[9] === readContentDoc)
  // contentRefs[10] is reserved for Skip structs
}

/**
 * Reported here: https://github.com/yjs/yjs/issues/308
 * @param {t.TestCase} _tc
 */
export const testDiffStateVectorOfUpdateIsEmpty = _tc => {
  const ydoc = new Y.Doc()
  /**
   * @type {any}
   */
  let sv = null
  ydoc.get().insert(0, 'a')
  ydoc.on('update', update => {
    sv = Y.encodeStateVectorFromUpdate(update)
  })
  // should produce an update with an empty state vector (because previous ops are missing)
  ydoc.get().insert(0, 'a')
  t.assert(sv !== null && sv.byteLength === 1 && sv[0] === 0)
}

/**
 * Reported here: https://github.com/yjs/yjs/issues/308
 * @param {t.TestCase} _tc
 */
export const testDiffStateVectorOfUpdateIgnoresSkips = _tc => {
  const ydoc = new Y.Doc()
  /**
   * @type {Array<Uint8Array<ArrayBuffer>>}
   */
  const updates = []
  ydoc.on('update', update => {
    updates.push(update)
  })
  ydoc.get().insert(0, 'a')
  ydoc.get().insert(0, 'b')
  ydoc.get().insert(0, 'c')
  const update13 = Y.mergeUpdates([updates[0], updates[2]])
  const sv = Y.encodeStateVectorFromUpdate(update13)
  const state = Y.decodeStateVector(sv)
  t.assert(state.get(ydoc.clientID) === 1)
  t.assert(state.size === 1)
}

/**
 * `cloneDoc` copies a doc in exactly its state, including what it received but cannot integrate
 * yet: a struct that waits for a missing dependency and lies inside a gap of its client — behind
 * which the doc already integrated an independent struct of the same client — and a pending delete.
 * Encoding the pending struct into the same update would make the clone defer the independent
 * struct as well.
 *
 * @param {t.TestCase} _tc
 */
export const testCloneDocWithPendingStructsInsideAGap = _tc => {
  const ydoc = new Y.Doc()
  ydoc.clientID = 1
  /**
   * @type {Array<Uint8Array<ArrayBuffer>>}
   */
  const updates = []
  ydoc.on('update', update => { updates.push(update) })
  ydoc.get('list').insert(0, 'a') // 1:0
  ydoc.get('list').insert(1, 'b') // 1:1, its origin is 1:0
  ydoc.get('map').setAttr('k', 'v') // 1:2, independent of 1:0 and 1:1
  ydoc.get('list').delete(0, 1) // deletes 1:0
  const doc = new Y.Doc()
  Y.applyUpdate(doc, updates[2]) // integrated behind the gap 1:0..1:1
  Y.applyUpdate(doc, updates[1]) // pending: waits for 1:0, inside the gap
  Y.applyUpdate(doc, updates[3]) // pending delete: 1:0 is unknown
  t.assert(doc.store.pendingStructs !== null && doc.store.pendingDs !== null && !doc.store.skips.isEmpty())
  /**
   * @param {Y.Doc} d
   */
  const read = d => ({ list: d.get('list').toDelta().toJSON(), map: d.get('map').toDelta().toJSON() })
  t.compare(read(doc), { list: { type: 'delta' }, map: { type: 'delta', attrs: { k: { type: 'insert', value: 'v' } } } })
  const clone = Y.cloneDoc(doc)
  t.compare(read(clone), read(doc), 'the clone shows what the doc shows')
  Y.applyUpdate(doc, updates[0])
  Y.applyUpdate(clone, updates[0])
  t.compare(read(clone), read(doc), 'both integrate the pending structs and deletes alike')
  t.compare(read(doc).list, { type: 'delta', children: [{ type: 'insert', insert: 'b' }] })
  t.assert(clone.store.pendingStructs === null && clone.store.pendingDs === null)
}

/**
 * An update that overlaps with content the doc already has must integrate everything around the
 * known ranges, even when they lie inside a single struct of the update. Before the fix, splitting
 * that struct around the first known range shortened it in place. The bounds read from it were then
 * stale: the rest of the update was replaced by a one-clock Skip and dropped (neither integrated nor
 * pending), and later known ranges weren't excluded at all.
 *
 * @param {t.TestCase} _tc
 */
export const testApplyUpdateAroundKnownContent = _tc => {
  /**
   * Encodes dependency-free GC structs of client 1, with Skips in between.
   *
   * @param {Array<[number, number]>} ranges sorted, non-adjacent [clock, len] pairs
   */
  const gcUpdate = ranges => {
    const enc = encoding.createEncoder()
    encoding.writeVarUint(enc, 1) // number of clients
    /**
     * @type {Array<[number, number]>}
     */
    const structs = []
    let clock = ranges[0][0]
    ranges.forEach(([start, len]) => {
      if (start > clock) structs.push([10, start - clock]) // Skip
      structs.push([0, len]) // GC
      clock = start + len
    })
    encoding.writeVarUint(enc, structs.length)
    encoding.writeVarUint(enc, 1) // client
    encoding.writeVarUint(enc, ranges[0][0]) // clock
    structs.forEach(([info, len]) => {
      encoding.writeUint8(enc, info)
      encoding.writeVarUint(enc, len)
    })
    encoding.writeVarUint(enc, 0) // empty delete set
    return encoding.toUint8Array(enc)
  }
  /**
   * @param {Array<Array<[number, number]>>} updates
   * @param {Array<[number, number]>} expected
   */
  const check = (updates, expected) => {
    const doc = new Y.Doc()
    updates.forEach(ranges => { Y.applyUpdate(doc, gcUpdate(ranges)) })
    t.assert(doc.store.pendingStructs === null)
    const inserts = Y.createContentIdsFromDoc(doc, true).inserts.clients.get(1)?.getIds().map(r => [r.clock, r.len])
    t.compare(inserts, expected)
  }
  // the reported case: the known range lies inside the only struct of the update
  check([[[102, 1]], [[70, 196]]], [[70, 196]])
  // several known ranges inside the same struct
  check([[[102, 1]], [[150, 10]], [[70, 196]]], [[70, 196]])
  // known ranges that exceed the update on both ends
  check([[[60, 20]], [[250, 30]], [[70, 196]]], [[60, 220]])
  // updates that consist of several structs
  check([[[80, 5], [100, 5]], [[70, 20], [95, 30]]], [[70, 20], [95, 30]])
}
