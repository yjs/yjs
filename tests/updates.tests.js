import * as t from 'lib0/testing'
import * as Y from '../src/index.js'
import { init, compare } from './testHelper.js' // eslint-disable-line
import { readBlockSet } from '../src/utils/BlockSet.js'
import { readIdSet, writeIdSet } from '../src/utils/ids.js'
import { UpdateDecoderV2 } from '../src/utils/UpdateDecoder.js'
import { UpdateEncoderV2 } from '../src/utils/UpdateEncoder.js'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as object from 'lib0/object'
import * as delta from 'lib0/delta'
import * as array from 'lib0/array'
import * as prng from 'lib0/prng'
import * as math from 'lib0/math'

/**
 * @typedef {Object} Enc
 * @property {function(Array<Uint8Array<ArrayBuffer>>):Uint8Array<ArrayBuffer>} Enc.mergeUpdates
 * @property {function(Y.Doc):Uint8Array<ArrayBuffer>} Enc.encodeStateAsUpdate
 * @property {function(Y.Doc, Uint8Array):void} Enc.applyUpdate
 * @property {function(Uint8Array):void} Enc.logUpdate
 * @property {function(Uint8Array):{deletes:Y.IdSet,inserts:Y.IdSet}} Enc.readUpdateToContentIds
 * @property {function(Y.Doc):Uint8Array<ArrayBuffer>} Enc.encodeStateVector
 * @property {function(Uint8Array):Uint8Array<ArrayBuffer>} Enc.encodeStateVectorFromUpdate
 * @property {'update'|'updateV2'} Enc.updateEventName
 * @property {string} Enc.description
 * @property {function(Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>):Uint8Array<ArrayBuffer>} Enc.diffUpdate
 */

/**
 * @type {Enc}
 */
const encV1 = {
  mergeUpdates: Y.mergeUpdates,
  encodeStateAsUpdate: Y.encodeStateAsUpdate,
  applyUpdate: Y.applyUpdate,
  logUpdate: Y.logUpdate,
  readUpdateToContentIds: Y.createContentIdsFromUpdate,
  encodeStateVectorFromUpdate: Y.encodeStateVectorFromUpdate,
  encodeStateVector: Y.encodeStateVector,
  updateEventName: 'update',
  description: 'V1',
  diffUpdate: Y.diffUpdate
}

/**
 * @type {Enc}
 */
const encV2 = {
  mergeUpdates: Y.mergeUpdatesV2,
  encodeStateAsUpdate: Y.encodeStateAsUpdateV2,
  applyUpdate: Y.applyUpdateV2,
  logUpdate: Y.logUpdateV2,
  readUpdateToContentIds: Y.createContentIdsFromUpdateV2,
  encodeStateVectorFromUpdate: Y.encodeStateVectorFromUpdateV2,
  encodeStateVector: Y.encodeStateVector,
  updateEventName: 'updateV2',
  description: 'V2',
  diffUpdate: Y.diffUpdateV2
}

/**
 * @type {Enc}
 */
const encDoc = {
  mergeUpdates: (updates) => {
    const ydoc = new Y.Doc({ gc: false })
    updates.forEach(update => {
      Y.applyUpdateV2(ydoc, update)
    })
    return Y.encodeStateAsUpdateV2(ydoc)
  },
  encodeStateAsUpdate: Y.encodeStateAsUpdateV2,
  applyUpdate: Y.applyUpdateV2,
  logUpdate: Y.logUpdateV2,
  readUpdateToContentIds: Y.createContentIdsFromUpdateV2,
  encodeStateVectorFromUpdate: Y.encodeStateVectorFromUpdateV2,
  encodeStateVector: Y.encodeStateVector,
  updateEventName: 'updateV2',
  description: 'Merge via Y.Doc',
  /**
   * @param {Uint8Array} update
   * @param {Uint8Array} sv
   */
  diffUpdate: (update, sv) => {
    const ydoc = new Y.Doc({ gc: false })
    Y.applyUpdateV2(ydoc, update)
    return Y.encodeStateAsUpdateV2(ydoc, sv)
  }
}

const encoders = [encV1, encV2, encDoc]

/**
 * @param {Array<Y.Doc>} users
 * @param {Enc} enc
 */
const fromUpdates = (users, enc) => {
  const updates = users.map(user =>
    enc.encodeStateAsUpdate(user)
  )
  const ydoc = new Y.Doc()
  enc.applyUpdate(ydoc, enc.mergeUpdates(updates))
  return ydoc
}

/**
 * @param {t.TestCase} tc
 */
export const testMergeUpdates = tc => {
  const { users, array0, array1 } = init(tc, { users: 3 })

  array0.insert(0, [1])
  array1.insert(0, [2])

  compare(users)
  encoders.forEach(enc => {
    const merged = fromUpdates(users, enc)
    t.compareArrays(array0.toArray(), merged.get('array').toArray())
  })
}

/**
 * @param {t.TestCase} tc
 */
export const testKeyEncoding = tc => {
  const { users, text0, text1 } = init(tc, { users: 2 })

  text0.insert(0, 'a', { italic: true })
  text0.insert(0, 'b')
  text0.insert(0, 'c', { italic: true })

  const update = Y.encodeStateAsUpdateV2(users[0])
  Y.applyUpdateV2(users[1], update)

  const c = text1.toDelta()
  t.compare(
    c,
    delta.create()
      .insert('c', { italic: true })
      .insert('b')
      .insert('a', { italic: true })
      .done()
  )

  compare(users)
}

/**
 * @param {Y.Doc} ydoc
 * @param {Array<Uint8Array<ArrayBuffer>>} updates - expecting at least 4 updates
 * @param {Enc} enc
 * @param {boolean} hasDeletes
 */
const checkUpdateCases = (ydoc, updates, enc, hasDeletes) => {
  const cases = []
  // Case 1: Simple case, simply merge everything
  cases.push(enc.mergeUpdates(updates))

  // Case 2: Overlapping updates
  cases.push(enc.mergeUpdates([
    enc.mergeUpdates(updates.slice(2)),
    enc.mergeUpdates(updates.slice(0, 2))
  ]))

  // Case 3: Overlapping updates
  cases.push(enc.mergeUpdates([
    enc.mergeUpdates(updates.slice(2)),
    enc.mergeUpdates(updates.slice(1, 3)),
    updates[0]
  ]))

  // Case 4: Separated updates (containing skips)
  cases.push(enc.mergeUpdates([
    enc.mergeUpdates([updates[0], updates[2]]),
    enc.mergeUpdates([updates[1], updates[3]]),
    enc.mergeUpdates(updates.slice(4))
  ]))

  // Case 5: overlapping with many duplicates
  cases.push(enc.mergeUpdates(cases))

  // const targetState = enc.encodeStateAsUpdate(ydoc)
  // t.info('Target State: ')
  // enc.logUpdate(targetState)

  cases.forEach((mergedUpdates, i) => {
    t.info(`State Case $${i} (${enc.description}):`)
    // enc.logUpdate(updates)
    const merged = new Y.Doc({ gc: false })
    enc.applyUpdate(merged, mergedUpdates)
    t.compareArrays(merged.get().toArray(), ydoc.get().toArray())
    t.compare(enc.encodeStateVector(merged), enc.encodeStateVectorFromUpdate(mergedUpdates))
    if (enc.updateEventName !== 'update') { // @todo should this also work on legacy updates?
      for (let j = 1; j < updates.length; j++) {
        const partMerged = enc.mergeUpdates(updates.slice(j))
        const partMeta = enc.readUpdateToContentIds(partMerged)
        const targetSV = enc.encodeStateVectorFromUpdate(enc.mergeUpdates(updates.slice(0, j)))
        const diffed = enc.diffUpdate(mergedUpdates, targetSV)
        const diffedMeta = enc.readUpdateToContentIds(diffed)
        t.compare(partMeta.inserts, diffedMeta.inserts)
        {
          // We can'd do the following
          //  - t.compare(diffed, mergedDeletes)
          // because diffed contains the set of all deletes.
          // So we add all deletes from `diffed` to `partDeletes` and compare then
          const decoder = decoding.createDecoder(diffed)
          const updateDecoder = new UpdateDecoderV2(decoder)
          readBlockSet(updateDecoder)
          const ds = readIdSet(updateDecoder)
          const updateEncoder = new UpdateEncoderV2()
          encoding.writeVarUint(updateEncoder.restEncoder, 0) // 0 structs
          writeIdSet(updateEncoder, ds)
          const deletesUpdate = updateEncoder.toUint8Array()
          const mergedDeletes = Y.mergeUpdatesV2([deletesUpdate, partMerged])
          if (!hasDeletes || enc !== encDoc) {
            // deletes will almost definitely lead to different encoders because of the mergeStruct feature that is present in encDoc
            t.compare(diffed, mergedDeletes)
          }
        }
      }
    }
    const meta = enc.readUpdateToContentIds(mergedUpdates)
    meta.inserts.clients.forEach(range => { t.assert(range.getIds()[0].clock === 0) })
    meta.inserts.clients.forEach((range, client) => {
      const structs = /** @type {Array<Y.Item>} */ (merged.store.clients.get(client))
      const lastStruct = structs[structs.length - 1]
      const lastIdRange = array.last(range.getIds())
      t.assert(lastStruct.id.clock + lastStruct.length === lastIdRange.clock + lastIdRange.len)
    })
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testMergeUpdates1 = _tc => {
  encoders.forEach((enc) => {
    t.info(`Using encoder: ${enc.description}`)
    const ydoc = new Y.Doc({ gc: false })
    const updates = /** @type {Array<Uint8Array<ArrayBuffer>>} */ ([])
    ydoc.on(enc.updateEventName, update => { updates.push(update) })
    const array = ydoc.get()
    array.insert(0, [1])
    array.insert(0, [2])
    array.insert(0, [3])
    array.insert(0, [4])
    checkUpdateCases(ydoc, updates, enc, false)
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testMergeUpdates2 = _tc => {
  encoders.forEach((enc, _i) => {
    t.info(`Using encoder: ${enc.description}`)
    const ydoc = new Y.Doc({ gc: false })
    const updates = /** @type {Array<Uint8Array<ArrayBuffer>>} */ ([])
    ydoc.on(enc.updateEventName, update => { updates.push(update) })
    const array = ydoc.get()
    array.insert(0, [1, 2])
    array.delete(1, 1)
    array.insert(0, [3, 4])
    array.delete(1, 2)
    checkUpdateCases(ydoc, updates, enc, true)
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testMergeUpdatesStressTest = _tc => {
  const N = 100
  const M = 100
  encoders.forEach((enc, _i) => {
    t.info(`Using encoder: ${enc.description}`)
    const ydoc = new Y.Doc({ gc: false })
    const updates = /** @type {Array<Uint8Array<ArrayBuffer>>} */ ([])
    ydoc.on(enc.updateEventName, update => { updates.push(update) })
    const array = ydoc.get()
    for (let clientid = 0; clientid < N; clientid++) {
      ydoc.clientID = clientid
      for (let i = 0; i < M; i++) {
        array.push([i])
      }
    }
    t.measureTime('merge via Y.mergeUpdates', () => {
      enc.mergeUpdates(updates)
    })
    t.measureTime('merge via Y.applyUpdate on Y.Doc', () => {
      const ydoc = new Y.Doc()
      updates.forEach(update => {
        enc.applyUpdate(ydoc, update)
      })
    })
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testMergePendingUpdates = _tc => {
  const yDoc = new Y.Doc()
  /**
   * @type {Array<Uint8Array>}
   */
  const serverUpdates = []
  yDoc.on('update', (update, _origin, _c) => {
    serverUpdates.splice(serverUpdates.length, 0, update)
  })
  const yText = yDoc.get('textBlock')
  yText.applyDelta(delta.create().insert('r').done())
  yText.applyDelta(delta.create().insert('o').done())
  yText.applyDelta(delta.create().insert('n').done())
  yText.applyDelta(delta.create().insert('e').done())
  yText.applyDelta(delta.create().insert('n').done())

  const yDoc1 = new Y.Doc()
  Y.applyUpdate(yDoc1, serverUpdates[0])
  const update1 = Y.encodeStateAsUpdate(yDoc1)

  const yDoc2 = new Y.Doc()
  Y.applyUpdate(yDoc2, update1)
  Y.applyUpdate(yDoc2, serverUpdates[1])
  const update2 = Y.encodeStateAsUpdate(yDoc2)

  const yDoc3 = new Y.Doc()
  Y.applyUpdate(yDoc3, update2)
  Y.applyUpdate(yDoc3, serverUpdates[3])
  const update3 = Y.encodeStateAsUpdate(yDoc3)

  const yDoc4 = new Y.Doc()
  Y.applyUpdate(yDoc4, update3)
  Y.applyUpdate(yDoc4, serverUpdates[2])
  const update4 = Y.encodeStateAsUpdate(yDoc4)

  const yDoc5 = new Y.Doc()
  Y.applyUpdate(yDoc5, update4)
  Y.applyUpdate(yDoc5, serverUpdates[4])
  Y.encodeStateAsUpdate(yDoc5)

  const yText5 = yDoc5.get('textBlock')
  t.compareStrings(yText5.toString(), 'nenor')
}

/**
 * @param {t.TestCase} _tc
 */
export const testObfuscateUpdates = _tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get('text')
  const ymap = ydoc.get('map')
  const yarray = ydoc.get('array')
  // test ytext
  ytext.applyDelta(delta.create().insert('text', { bold: true }).insert([{ href: 'supersecreturl' }]).done())
  // test ymap
  ymap.setAttr('key', 'secret1')
  ymap.setAttr('key', 'secret2')
  // test yarray with subtype & subdoc
  const subtype = new Y.Node('secretnodename')
  const subdoc = new Y.Doc({ guid: 'secret' })
  subtype.setAttr('attr', 'val')
  yarray.insert(0, ['teststring', 42, subtype, subdoc])
  // obfuscate the content and put it into a new document
  const obfuscatedUpdate = Y.obfuscateUpdate(Y.encodeStateAsUpdate(ydoc))
  const odoc = new Y.Doc()
  Y.applyUpdate(odoc, obfuscatedUpdate)
  const otext = odoc.get('text')
  const omap = odoc.get('map')
  const oarray = odoc.get('array')
  // test ytext
  const d = /** @type {any} */ (otext.toDelta().toJSON().children)
  t.assert(d.length === 2)
  t.assert(d[0].insert !== 'text' && d[0].insert.length === 4)
  t.assert(object.length(d[0].format) === 1)
  t.assert(!object.hasProperty(d[0].format, 'bold'))
  t.assert(object.length(d[1].insert) === 1)
  t.assert(object.hasProperty(d[1], 'insert'))
  // test ymap
  t.assert(omap.attrSize === 1)
  t.assert(!omap.hasAttr('key'))
  // test yarray with subtype & subdoc
  const result = oarray.toArray()
  t.assert(result.length === 4)
  t.assert(result[0] !== 'teststring')
  t.assert(result[1] !== 42)
  const osubtype = /** @type {Y.Node} */ (result[2])
  const osubdoc = result[3]
  // test subtype
  t.assert(osubtype.name !== subtype.name)
  t.assert(object.length(osubtype.getAttrs()) === 1)
  t.assert(osubtype.getAttr('attr') === undefined)
  // test subdoc
  t.assert(osubdoc.guid !== subdoc.guid)
}

export const testIntersectDoc = () => {
  const ydoc = new Y.Doc()
  ydoc.get().setAttr('k', 1)
  const c1 = Y.createContentIdsFromDoc(ydoc, true)
  ydoc.get().setAttr('k', 2)

  const v1 = Y.intersectUpdateWithContentIds(Y.encodeStateAsUpdate(ydoc), c1)
  const y1 = new Y.Doc()
  Y.applyUpdate(y1, v1)
  t.assert(ydoc.get().getAttr('k'))
}

/**
 * Selecting a sparse mid-stream range of content-ids must not drop the selection
 * just because earlier structs of the same client were not selected.
 *
 * @see https://github.com/yjs/yjs/issues/781
 */
export const testIntersectSparseContentIds = () => {
  const src = new Y.Doc()
  src.transact(() => {
    const m = src.get('m')
    for (let i = 0; i < 10; i++) m.setAttr(`k${i}`, i) // clocks 0..9, single client
  })
  const update = Y.encodeStateAsUpdate(src)
  const cids = Y.createContentIdsFromUpdate(update)
  /**
   * @type {number}
   */
  let client = 0
  cids.inserts.clients.forEach((_r, c) => { client = c })

  // Select ONLY clocks [5, 7) — a mid-stream range.
  const sel = Y.createIdSet()
  sel.add(client, 5, 2)
  const chunk = Y.intersectUpdateWithContentIds(update, {
    inserts: sel,
    deletes: Y.createIdSet()
  })
  // Each map key is a separate length-1 item, so clocks [5,7) yield two structs.
  const structs = Y.decodeUpdate(chunk).structs.filter(s => !(s instanceof Y.Skip))
  t.assert(structs.every(s => s.id.client === client))
  t.compare(structs.map(s => [s.id.clock, s.length]), [[5, 1], [6, 1]])

  // A selection split across a gap must round-trip both ranges with a Skip in between.
  const sel2 = Y.createIdSet()
  sel2.add(client, 1, 2) // clocks 1,2
  sel2.add(client, 7, 1) // clock 7
  const chunk2 = Y.intersectUpdateWithContentIds(update, {
    inserts: sel2,
    deletes: Y.createIdSet()
  })
  const structs2 = Y.decodeUpdate(chunk2).structs.filter(s => !(s instanceof Y.Skip))
  t.compare(structs2.map(s => [s.id.clock, s.length]), [[1, 1], [2, 1], [7, 1]])

  // A full-coverage selection must round-trip byte-identically to the source update.
  const selAll = Y.createIdSet()
  cids.inserts.clients.forEach((ranges, c) => {
    ranges.getIds().forEach(r => selAll.add(c, r.clock, r.len))
  })
  const chunkAll = Y.intersectUpdateWithContentIds(update, {
    inserts: selAll,
    deletes: Y.createIdSet()
  })
  t.compare(chunkAll, update)
}

/**
 * Describe the content that an update retains for every id. The description is independent of how
 * the ids are split into structs.
 *
 * @param {Array<Y.Item|Y.GC|Y.Skip>} structs
 */
const describeStructs = structs => {
  /**
   * @type {Array<string>}
   */
  const res = []
  structs.forEach(s => {
    if (s instanceof Y.Skip) return
    const content = s instanceof Y.Item ? s.content.getContent() : []
    for (let i = 0; i < s.length; i++) {
      const c = content[i]
      const desc = s instanceof Y.Item ? `${s.content.constructor.name}:${c instanceof Y.Node ? 'node' : JSON.stringify(c)}` : 'GC'
      res.push(`${s.id.client}:${s.id.clock + i}:${desc}${s instanceof Y.Item && s.deleted ? ':deleted' : ''}`)
    }
  })
  return res.sort()
}

/**
 * @param {number} client
 * @param {number} clock
 * @param {number} len
 */
const insertIds = (client, clock, len) => {
  const inserts = Y.createIdSet()
  inserts.add(client, clock, len)
  return { inserts, deletes: Y.createIdSet() }
}

const mergeFunctions = [
  { merge: Y.mergeUpdates, encode: Y.encodeStateAsUpdate, apply: Y.applyUpdate, decode: Y.decodeUpdate, intersect: Y.intersectUpdateWithContentIds, contentIds: Y.createContentIdsFromUpdate },
  { merge: Y.mergeUpdatesV2, encode: Y.encodeStateAsUpdateV2, apply: Y.applyUpdateV2, decode: Y.decodeUpdateV2, intersect: Y.intersectUpdateWithContentIdsV2, contentIds: Y.createContentIdsFromUpdateV2 }
]

/**
 * Merging a gc'd encoding with a non-gc'd encoding of the same history must retain the content,
 * independent of the order of the updates.
 *
 * @param {t.TestCase} _tc
 */
export const testMergeUpdatesRetainsGcdContent = _tc => {
  mergeFunctions.forEach(enc => {
    const server = new Y.Doc({ gc: false })
    server.get().applyDelta(delta.create().insert('abc').done())
    server.get().applyDelta(delta.create().retain(1).delete(1).done())
    const nongc = enc.encode(server)
    const gcPeer = new Y.Doc({ gc: true })
    enc.apply(gcPeer, nongc)
    const client = new Y.Doc()
    enc.apply(client, enc.encode(gcPeer))
    client.get().applyDelta(delta.create().insert('d').done())
    const patch = enc.encode(client)
    const tailIds = insertIds(server.clientID, 1, 2)
    const expected = describeStructs(enc.decode(enc.merge([nongc, enc.intersect(patch, insertIds(client.clientID, 0, 1))])).structs)
    t.assert(expected.some(desc => desc === `${server.clientID}:1:ContentString:"b"`))
    // equal start, local starts earlier, local starts later - each with the stub on either side
    ;[
      [nongc, patch],
      [patch, nongc],
      [patch, enc.intersect(nongc, tailIds)],
      [enc.intersect(nongc, tailIds), patch],
      [nongc, enc.intersect(patch, tailIds), enc.intersect(patch, insertIds(client.clientID, 0, 1))],
      [enc.intersect(patch, tailIds), nongc, enc.intersect(patch, insertIds(client.clientID, 0, 1))]
    ].forEach(updates => {
      const merged = enc.merge(updates)
      t.compare(describeStructs(enc.decode(merged).structs), expected)
      const ydoc = new Y.Doc({ gc: false })
      enc.apply(ydoc, merged)
      t.compare(ydoc.get().toDelta().toJSON().children, [{ type: 'insert', insert: 'dac' }])
      Y.undoContentIds(ydoc, { inserts: Y.createIdSet(), deletes: enc.contentIds(merged).deletes }, { ignoreRemoteAttributeChanges: true })
      t.compare(ydoc.get().toDelta().toJSON().children, [{ type: 'insert', insert: 'dabc' }])
    })
  })
}

/**
 * A stub that covers [0,3) must be sliced around content that covers [1,2).
 *
 * @param {t.TestCase} _tc
 */
export const testMergeUpdatesPartialOverlapWithStub = _tc => {
  mergeFunctions.forEach(enc => {
    const ydoc = new Y.Doc({ gc: false })
    const clientid = ydoc.clientID
    ydoc.get().applyDelta(delta.create().insert('abc').done())
    ydoc.get().applyDelta(delta.create().delete(3).done())
    const nongc = enc.encode(ydoc)
    const gcDoc = new Y.Doc({ gc: true })
    enc.apply(gcDoc, nongc)
    const stub = enc.encode(gcDoc)
    t.compare(enc.decode(stub).structs.map(s => [s.id.clock, s.length]), [[0, 3]])
    const content = enc.intersect(nongc, insertIds(clientid, 1, 1))
    const expected = [`${clientid}:0:ContentDeleted:undefined`, `${clientid}:1:ContentString:"b"`, `${clientid}:2:ContentDeleted:undefined`]
    t.compare(describeStructs(enc.decode(enc.merge([stub, content])).structs), expected)
    t.compare(describeStructs(enc.decode(enc.merge([content, stub])).structs), expected)
  })
}

/**
 * When both sides are stubs, the merge retains the encoding that knows more (Item with
 * ContentDeleted > GC).
 *
 * @param {t.TestCase} _tc
 */
export const testMergeUpdatesStubs = _tc => {
  mergeFunctions.forEach(enc => {
    const ydoc = new Y.Doc({ gc: false })
    const clientid = ydoc.clientID
    ydoc.get().insert(0, [Y.Node.from(delta.create().insert('ab'))])
    const insertOnly = enc.encode(ydoc)
    // gc only the content of the nested type
    const gcChildren = new Y.Doc({ gc: true })
    enc.apply(gcChildren, insertOnly)
    gcChildren.get().get(0).delete(0, 2)
    const childStubs = enc.encode(gcChildren)
    // gc the nested type and its content
    const gcAll = new Y.Doc({ gc: true })
    enc.apply(gcAll, insertOnly)
    gcAll.get().delete(0, 1)
    const gcStubs = enc.encode(gcAll)
    const expected = [`${clientid}:0:ContentType:node`, `${clientid}:1:ContentDeleted:undefined`, `${clientid}:2:ContentDeleted:undefined`]
    t.compare(describeStructs(enc.decode(childStubs).structs).filter(desc => !desc.startsWith(gcChildren.clientID + ':')), expected)
    t.compare(describeStructs(enc.decode(gcStubs).structs).filter(desc => !desc.startsWith(gcAll.clientID + ':')), [`${clientid}:0:ContentDeleted:undefined`, `${clientid}:1:GC`, `${clientid}:2:GC`])
    const ownStructs = enc.intersect(childStubs, insertIds(clientid, 0, 3))
    t.compare(describeStructs(enc.decode(enc.merge([ownStructs, gcStubs])).structs), expected)
    t.compare(describeStructs(enc.decode(enc.merge([gcStubs, ownStructs])).structs), expected)
  })
}

/**
 * Merge several encodings of the same history, with random subsets of the deleted content gc'd, in
 * random order. The result must always retain the full history.
 *
 * @param {t.TestCase} tc
 */
export const testRepeatMergeUpdatesWithGcdEncodings = tc => {
  const gen = tc.prng
  const enc = prng.oneOf(gen, mergeFunctions)
  const updates = /** @type {Array<Uint8Array<ArrayBuffer>>} */ ([])
  const ydocs = array.unfold(3, i => {
    const ydoc = new Y.Doc({ gc: false })
    ydoc.clientID = i + 1
    ydoc.on('updateV2', update => {
      updates.push(enc.merge === Y.mergeUpdates ? Y.convertUpdateFormatV2ToV1(update) : update)
    })
    return ydoc
  })
  for (let i = 0; i < 40; i++) {
    const ydoc = prng.oneOf(gen, ydocs)
    // edit the root type or one of the nested types
    const nested = ydoc.get().toArray().filter(c => c instanceof Y.Node)
    const ytype = nested.length > 0 && prng.bool(gen) ? prng.oneOf(gen, nested) : ydoc.get()
    const action = prng.int31(gen, 0, 5)
    if (action === 0) {
      // sync with the other clients
      const knownUpdates = updates.length
      for (let j = 0; j < knownUpdates; j++) {
        Y.transact(ydoc, () => { enc.apply(ydoc, updates[j]) }, 'sync', false)
      }
    } else if (action === 1 && ytype.length > 0) {
      const pos = prng.int31(gen, 0, ytype.length - 1)
      ytype.delete(pos, prng.int31(gen, 1, math.min(3, ytype.length - pos)))
    } else if (action === 2 && ytype === ydoc.get()) {
      ytype.insert(prng.int31(gen, 0, ytype.length), [Y.Node.from(delta.create().insert([1, 2, 3]))])
    } else {
      ytype.insert(prng.int31(gen, 0, ytype.length), array.unfold(prng.int31(gen, 1, 3), j => i * 10 + j))
    }
  }
  /**
   * @param {Uint8Array<ArrayBuffer>} update
   */
  const describeUpdate = update => {
    const ydoc = new Y.Doc({ gc: false })
    enc.apply(ydoc, update)
    t.assert(ydoc.store.pendingStructs === null)
    return {
      content: ydoc.get().toDelta().toJSON(),
      structs: describeStructs(array.from(ydoc.store.clients.values()).flat())
    }
  }
  const expected = describeUpdate(enc.merge(updates))
  const splitAt = prng.int31(gen, 1, updates.length - 1)
  // the first two encodings retain the full history
  const encodings = [enc.merge(updates.slice(0, splitAt)), enc.merge(updates.slice(splitAt))]
  for (let i = prng.int31(gen, 1, 4); i > 0; i--) {
    const ydoc = new Y.Doc({ gc: prng.bool(gen), gcFilter: () => prng.bool(gen) })
    updates.slice(0, prng.int31(gen, 1, updates.length)).forEach(update => {
      enc.apply(ydoc, update)
    })
    encodings.push(enc.encode(ydoc))
  }
  for (let i = 0; i < 5; i++) {
    for (let j = encodings.length - 1; j > 0; j--) {
      const k = prng.int31(gen, 0, j)
      ;[encodings[j], encodings[k]] = [encodings[k], encodings[j]]
    }
    const splitAt = prng.int31(gen, 0, encodings.length)
    const merged = prng.bool(gen)
      ? enc.merge(encodings)
      : enc.merge([enc.merge(encodings.slice(splitAt)), enc.merge(encodings.slice(0, splitAt))])
    t.compare(describeUpdate(merged), expected)
    // merging is idempotent
    const again = prng.oneOf(gen, encodings)
    t.compare(describeUpdate(enc.merge([merged, again])), expected)
    t.compare(describeUpdate(enc.merge([again, merged])), expected)
  }
}
