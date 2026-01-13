import * as t from 'lib0/testing'
import * as Y from '../src/index.js'
import { init, compare } from './testHelper.js' // eslint-disable-line
import { readStructSet, readIdSet, UpdateDecoderV2, UpdateEncoderV2, writeIdSet } from '../src/internals.js'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as object from 'lib0/object'
import * as delta from 'lib0/delta'
import * as array from 'lib0/array'

/**
 * @typedef {Object} Enc
 * @property {function(Array<Uint8Array<ArrayBuffer>>):Uint8Array<ArrayBuffer>} Enc.mergeUpdates
 * @property {function(Y.Doc):Uint8Array<ArrayBuffer>} Enc.encodeStateAsUpdate
 * @property {function(Y.Doc, Uint8Array):void} Enc.applyUpdate
 * @property {function(Uint8Array):void} Enc.logUpdate
 * @property {function(Uint8Array):{deletes:Y.IdSet,inserts:Y.IdSet}} Enc.readUpdateToContentIds
 * @property {function(Y.Doc):Uint8Array} Enc.encodeStateVector
 * @property {function(Uint8Array):Uint8Array} Enc.encodeStateVectorFromUpdate
 * @property {'update'|'updateV2'} Enc.updateEventName
 * @property {string} Enc.description
 * @property {function(Uint8Array, Uint8Array):Uint8Array} Enc.diffUpdate
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
          readStructSet(updateDecoder, new Y.Doc())
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
  yText.applyDelta(delta.create().insert('r'))
  yText.applyDelta(delta.create().insert('o'))
  yText.applyDelta(delta.create().insert('n'))
  yText.applyDelta(delta.create().insert('e'))
  yText.applyDelta(delta.create().insert('n'))

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
  ytext.applyDelta(delta.create().insert('text', { bold: true }).insert([{ href: 'supersecreturl' }]))
  // test ymap
  ymap.setAttr('key', 'secret1')
  ymap.setAttr('key', 'secret2')
  // test yarray with subtype & subdoc
  const subtype = new Y.Type('secretnodename')
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
  t.assert(result.length === 3)
  t.assert(result[0] !== 'teststring')
  t.assert(result[1] !== 42)
  const osubtype = /** @type {Y.Type} */ (result[2])
  const osubdoc = result[2]
  // test subtype
  t.assert(osubtype.name !== subtype.name)
  t.assert(object.length(osubtype.getAttrs()) === 1)
  t.assert(osubtype.getAttr('attr') === undefined)
  // test subdoc
  t.assert(osubdoc.guid !== subdoc.guid)
}
