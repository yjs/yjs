import * as t from 'lib0/testing'
import * as Y from '../src/index.js'
import * as d from '../src/utils/ids.js'
import * as math from 'lib0/math'
import * as prng from 'lib0/prng'
import { compareIdSets, createRandomIdSet, ID } from './testHelper.js'

/**
 * @param {Array<[number, number, number]>} ops
 */
const simpleConstructIdSet = ops => {
  const idset = d.createIdSet()
  ops.forEach(op => {
    idset.add(op[0], op[1], op[2])
  })
  return idset
}

/**
 * @param {t.TestCase} _tc
 */
export const testIdsetMerge = _tc => {
  t.group('filter out empty items (1))', () => {
    compareIdSets(
      simpleConstructIdSet([[0, 1, 0]]),
      simpleConstructIdSet([])
    )
  })
  t.group('filter out empty items (2))', () => {
    compareIdSets(
      simpleConstructIdSet([[0, 1, 0], [0, 2, 0]]),
      simpleConstructIdSet([])
    )
  })
  t.group('filter out empty items (3 - end))', () => {
    compareIdSets(
      simpleConstructIdSet([[0, 1, 1], [0, 2, 0]]),
      simpleConstructIdSet([[0, 1, 1]])
    )
  })
  t.group('filter out empty items (4 - middle))', () => {
    compareIdSets(
      simpleConstructIdSet([[0, 1, 1], [0, 2, 0], [0, 3, 1]]),
      simpleConstructIdSet([[0, 1, 1], [0, 3, 1]])
    )
  })
  t.group('filter out empty items (5 - beginning))', () => {
    compareIdSets(
      simpleConstructIdSet([[0, 1, 0], [0, 2, 1], [0, 3, 1]]),
      simpleConstructIdSet([[0, 2, 1], [0, 3, 1]])
    )
  })
  t.group('merge of overlapping id ranges', () => {
    compareIdSets(
      simpleConstructIdSet([[0, 1, 2], [0, 0, 2]]),
      simpleConstructIdSet([[0, 0, 3]])
    )
  })
  t.group('construct without hole', () => {
    compareIdSets(
      simpleConstructIdSet([[0, 1, 2], [0, 3, 1]]),
      simpleConstructIdSet([[0, 1, 3]])
    )
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testDiffing = _tc => {
  t.group('simple case (1))', () => {
    compareIdSets(
      d.diffIdSet(
        simpleConstructIdSet([[0, 1, 1], [0, 3, 1]]),
        simpleConstructIdSet([[0, 3, 1]])
      ),
      simpleConstructIdSet([[0, 1, 1]])
    )
  })
  t.group('subset left', () => {
    compareIdSets(
      d.diffIdSet(
        simpleConstructIdSet([[0, 1, 3]]),
        simpleConstructIdSet([[0, 1, 1]])
      ),
      simpleConstructIdSet([[0, 2, 2]])
    )
  })
  t.group('subset right', () => {
    compareIdSets(
      d.diffIdSet(
        simpleConstructIdSet([[0, 1, 3]]),
        simpleConstructIdSet([[0, 3, 1]])
      ),
      simpleConstructIdSet([[0, 1, 2]])
    )
  })
  t.group('subset middle', () => {
    compareIdSets(
      d.diffIdSet(
        simpleConstructIdSet([[0, 1, 3]]),
        simpleConstructIdSet([[0, 2, 1]])
      ),
      simpleConstructIdSet([[0, 1, 1], [0, 3, 1]])
    )
  })
  t.group('overlapping left', () => {
    compareIdSets(
      d.diffIdSet(
        simpleConstructIdSet([[0, 1, 3]]),
        simpleConstructIdSet([[0, 0, 2]])
      ),
      simpleConstructIdSet([[0, 2, 2]])
    )
  })
  t.group('overlapping right', () => {
    compareIdSets(
      d.diffIdSet(
        simpleConstructIdSet([[0, 1, 3]]),
        simpleConstructIdSet([[0, 3, 5]])
      ),
      simpleConstructIdSet([[0, 1, 2]])
    )
  })
  t.group('overlapping completely', () => {
    compareIdSets(
      d.diffIdSet(
        simpleConstructIdSet([[0, 1, 3]]),
        simpleConstructIdSet([[0, 0, 5]])
      ),
      simpleConstructIdSet([])
    )
  })
  t.group('overlapping into new range', () => {
    compareIdSets(
      d.diffIdSet(
        simpleConstructIdSet([[0, 1, 3], [0, 5, 2]]),
        simpleConstructIdSet([[0, 0, 6]])
      ),
      simpleConstructIdSet([[0, 6, 1]])
    )
  })
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatRandomDiffing = tc => {
  const clients = 4
  const clockRange = 100
  const ds1 = createRandomIdSet(tc.prng, clients, clockRange)
  const ds2 = createRandomIdSet(tc.prng, clients, clockRange)
  const merged = d.mergeIdSets([ds1, ds2])
  const e1 = d.diffIdSet(ds1, ds2)
  const e2 = d.diffIdSet(merged, ds2)
  compareIdSets(e1, e2)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatRandomDeletes = tc => {
  const clients = 1
  const clockRange = 100
  const idset = createRandomIdSet(tc.prng, clients, clockRange)
  const client = Array.from(idset.clients.keys())[0]
  const clock = prng.int31(tc.prng, 0, clockRange)
  const len = prng.int31(tc.prng, 0, math.round((clockRange - clock) * 1.2)) // allow exceeding range to cover more edge cases
  const idsetOfDeletes = d.createIdSet()
  idsetOfDeletes.add(client, clock, len)
  const diffed = d.diffIdSet(idset, idsetOfDeletes)
  idset.delete(client, clock, len)
  for (let i = 0; i < len; i++) {
    t.assert(!idset.has(client, clock + i))
  }
  compareIdSets(idset, diffed)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatMergingMultipleIdsets = tc => {
  const clients = 4
  const clockRange = 100
  /**
   * @type {Array<d.IdSet>}
   */
  const idss = []
  for (let i = 0; i < 3; i++) {
    idss.push(createRandomIdSet(tc.prng, clients, clockRange))
  }
  const merged = d.mergeIdSets(idss)
  const mergedReverse = d.mergeIdSets(idss.reverse())
  compareIdSets(merged, mergedReverse)
  const composed = d.createIdSet()
  for (let iclient = 0; iclient < clients; iclient++) {
    for (let iclock = 0; iclock < clockRange + 42; iclock++) {
      const mergedHas = merged.hasId(new ID(iclient, iclock))
      const oneHas = idss.some(ids => ids.hasId(new ID(iclient, iclock)))
      t.assert(mergedHas === oneHas)
      if (oneHas) {
        composed.add(iclient, iclock, 1)
      }
    }
  }
  compareIdSets(merged, composed)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatRandomDiffing2 = tc => {
  const clients = 4
  const clockRange = 100
  const ids1 = createRandomIdSet(tc.prng, clients, clockRange)
  const ids2 = createRandomIdSet(tc.prng, clients, clockRange)
  const idsExclude = createRandomIdSet(tc.prng, clients, clockRange)
  const merged = d.mergeIdSets([ids1, ids2])
  const mergedExcluded = d.diffIdSet(merged, idsExclude)
  const e1 = d.diffIdSet(ids1, idsExclude)
  const e2 = d.diffIdSet(ids2, idsExclude)
  const excludedMerged = d.mergeIdSets([e1, e2])
  compareIdSets(mergedExcluded, excludedMerged)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatRandomIntersects = tc => {
  const clients = 4
  const clockRange = 100
  const ids1 = createRandomIdSet(tc.prng, clients, clockRange)
  const ids2 = createRandomIdSet(tc.prng, clients, clockRange)
  const intersected = d.intersectSets(ids1, ids2)
  for (let client = 0; client < clients; client++) {
    for (let clock = 0; clock < clockRange; clock++) {
      t.assert((ids1.has(client, clock) && ids2.has(client, clock)) === intersected.has(client, clock))
    }
  }
  const diffed1 = d.diffIdSet(ids1, ids2)
  const altDiffed1 = d.diffIdSet(ids1, intersected)
  compareIdSets(diffed1, altDiffed1)
}

/**
 * The struct that covers `clock` for the document's local client.
 *
 * @param {Y.Doc} doc
 * @param {number} clock
 * @return {any}
 */
const structAt = (doc, clock) => {
  const structs = /** @type {Array<any>} */ (doc.store.clients.get(doc.clientID))
  return structs[Y.findIndexSS(structs, clock)]
}

/**
 * `gcIdSet` collects the deleted content referenced by an IdSet on a `gc: false` document,
 * without changing the observable state, and the result still converges with a peer.
 *
 * @param {t.TestCase} _tc
 */
export const testGcIdSetBasic = _tc => {
  const doc = new Y.Doc({ gc: false })
  const yarr = doc.get('array')
  yarr.insert(0, ['a', 'b', 'c', 'd'])
  yarr.delete(1, 2) // delete 'b' (clock 1) and 'c' (clock 2)
  // gc is disabled, so the deleted content is retained
  t.assert(structAt(doc, 1).content instanceof Y.ContentAny)

  Y.gcIdSet(doc, Y.createDeleteSetFromStructStore(doc.store))

  // observable state is unchanged
  t.compare(yarr.toArray(), ['a', 'd'])
  // every collectible deleted item is now collected
  doc.store.clients.forEach(structs => {
    structs.forEach(struct => {
      if (struct.constructor === Y.Item && struct.deleted && !struct.keep) {
        t.assert(struct.content instanceof Y.ContentDeleted)
      }
    })
  })
  // still converges with a fresh peer
  const peer = new Y.Doc()
  Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc))
  t.compare(peer.get('array').toArray(), ['a', 'd'])
}

/**
 * `gcIdSet` splits structs at the IdSet boundaries, so only the exact referenced content is
 * collected - the rest of a partially-covered deleted run is preserved.
 *
 * @param {t.TestCase} _tc
 */
export const testGcIdSetPartialRange = _tc => {
  const doc = new Y.Doc({ gc: false })
  const yarr = doc.get('array')
  yarr.insert(0, ['a', 'b', 'c', 'd', 'e'])
  yarr.delete(1, 4) // delete 'b','c','d','e' (clocks 1..4), retained because gc is off

  // collect only the middle of the deleted run: clocks 2..3 ('c', 'd')
  const ids = d.createIdSet()
  ids.add(doc.clientID, 2, 2)
  Y.gcIdSet(doc, ids)

  t.compare(yarr.toArray(), ['a'])
  // 'b' (clock 1) and 'e' (clock 4) are outside the IdSet -> still retained
  t.assert(structAt(doc, 1).deleted && structAt(doc, 1).content instanceof Y.ContentAny)
  t.assert(structAt(doc, 4).deleted && structAt(doc, 4).content instanceof Y.ContentAny)
  // 'c','d' (clocks 2..3) were inside the IdSet -> collected
  t.assert(structAt(doc, 2).content instanceof Y.ContentDeleted)
}

/**
 * Ids that don't reference collectible content (live content) are skipped.
 *
 * @param {t.TestCase} _tc
 */
export const testGcIdSetSkipsLiveContent = _tc => {
  const doc = new Y.Doc({ gc: false })
  const yarr = doc.get('array')
  yarr.insert(0, ['a', 'b', 'c'])
  yarr.delete(1, 1) // delete only 'b'

  // pass *all* ids (live + deleted); only the deleted one is collectible
  Y.gcIdSet(doc, Y.createInsertSetFromStructStore(doc.store, false))

  t.compare(yarr.toArray(), ['a', 'c'])
  t.assert(structAt(doc, 0).content instanceof Y.ContentAny) // 'a' is live -> untouched
  t.assert(structAt(doc, 2).content instanceof Y.ContentAny) // 'c' is live -> untouched
  t.assert(structAt(doc, 1).content instanceof Y.ContentDeleted) // 'b' was deleted -> collected
}

/**
 * Calling `gcIdSet` twice is a no-op the second time.
 *
 * @param {t.TestCase} _tc
 */
export const testGcIdSetIdempotent = _tc => {
  const doc = new Y.Doc({ gc: false })
  const yarr = doc.get('array')
  yarr.insert(0, ['a', 'b', 'c'])
  yarr.delete(0, 2)
  const ds = Y.createDeleteSetFromStructStore(doc.store)
  Y.gcIdSet(doc, ds)
  const encoded = Y.encodeStateAsUpdate(doc)
  Y.gcIdSet(doc, ds) // second pass changes nothing
  t.compare(yarr.toArray(), ['c'])
  t.compare(Y.encodeStateAsUpdate(doc), encoded)
}

/**
 * Items flagged with `keep` (e.g. protected by an UndoManager) are not collected.
 *
 * @param {t.TestCase} _tc
 */
export const testGcIdSetRespectsKeep = _tc => {
  const doc = new Y.Doc({ gc: false })
  const yarr = doc.get('array')
  yarr.insert(0, ['a', 'b', 'c'])
  yarr.delete(1, 1) // delete 'b' (clock 1)
  structAt(doc, 1).keep = true // protect it from gc

  Y.gcIdSet(doc, Y.createDeleteSetFromStructStore(doc.store))

  // 'b' was kept -> still retained, not collected
  t.assert(structAt(doc, 1).deleted && structAt(doc, 1).content instanceof Y.ContentAny)
}
