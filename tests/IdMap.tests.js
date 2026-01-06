import * as t from 'lib0/testing'
import * as idmap from '../src/utils/IdMap.js'
import * as prng from 'lib0/prng'
import * as math from 'lib0/math'
import { compareIdmaps as compareIdMaps, createIdMap, ID, createRandomIdSet, createRandomIdMap, createAttributionItem } from './testHelper.js'
import * as YY from '../src/internals.js'
import * as time from 'lib0/time'

/**
 * @template T
 * @param {Array<[number, number, number, Array<T>]>} ops
 */
const simpleConstructAttrs = ops => {
  const attrs = createIdMap()
  ops.forEach(op => {
    attrs.add(op[0], op[1], op[2], op[3].map(v => createAttributionItem('', v)))
  })
  return attrs
}

/**
 * @param {t.TestCase} _tc
 */
export const testAmMerge = _tc => {
  const attrs = [42]
  t.group('filter out empty items (1))', () => {
    compareIdMaps(
      simpleConstructAttrs([[0, 1, 0, attrs]]),
      simpleConstructAttrs([])
    )
  })
  t.group('filter out empty items (2))', () => {
    compareIdMaps(
      simpleConstructAttrs([[0, 1, 0, attrs], [0, 2, 0, attrs]]),
      simpleConstructAttrs([])
    )
  })
  t.group('filter out empty items (3 - end))', () => {
    compareIdMaps(
      simpleConstructAttrs([[0, 1, 1, attrs], [0, 2, 0, attrs]]),
      simpleConstructAttrs([[0, 1, 1, attrs]])
    )
  })
  t.group('filter out empty items (4 - middle))', () => {
    compareIdMaps(
      simpleConstructAttrs([[0, 1, 1, attrs], [0, 2, 0, attrs], [0, 3, 1, attrs]]),
      simpleConstructAttrs([[0, 1, 1, attrs], [0, 3, 1, attrs]])
    )
  })
  t.group('filter out empty items (5 - beginning))', () => {
    compareIdMaps(
      simpleConstructAttrs([[0, 1, 0, attrs], [0, 2, 1, attrs], [0, 3, 1, attrs]]),
      simpleConstructAttrs([[0, 2, 1, attrs], [0, 3, 1, attrs]])
    )
  })
  t.group('merge of overlapping id ranges', () => {
    compareIdMaps(
      simpleConstructAttrs([[0, 1, 2, attrs], [0, 0, 2, attrs]]),
      simpleConstructAttrs([[0, 0, 3, attrs]])
    )
  })
  t.group('construct without hole', () => {
    compareIdMaps(
      simpleConstructAttrs([[0, 1, 2, attrs], [0, 3, 1, attrs]]),
      simpleConstructAttrs([[0, 1, 3, attrs]])
    )
  })
  t.group('no merge of overlapping id ranges with different attributes', () => {
    compareIdMaps(
      simpleConstructAttrs([[0, 1, 2, [1]], [0, 0, 2, [2]]]),
      simpleConstructAttrs([[0, 0, 1, [2]], [0, 1, 1, [1, 2]], [0, 2, 1, [1]]])
    )
  })
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatMergingMultipleIdMaps = tc => {
  const clients = 4
  const clockRange = 5
  /**
   * @type {Array<idmap.IdMap<number>>}
   */
  const sets = []
  for (let i = 0; i < 3; i++) {
    sets.push(createRandomIdMap(tc.prng, clients, clockRange, [1, 2, 3]))
  }
  const merged = idmap.mergeIdMaps(sets)
  const mergedReverse = idmap.mergeIdMaps(sets.reverse())
  compareIdMaps(merged, mergedReverse)
  const composed = idmap.createIdMap()
  for (let iclient = 0; iclient < clients; iclient++) {
    for (let iclock = 0; iclock < clockRange + 42; iclock++) {
      const mergedHas = merged.hasId(new ID(iclient, iclock))
      const oneHas = sets.some(ids => ids.hasId(new ID(iclient, iclock)))
      t.assert(mergedHas === oneHas)
      const mergedAttrs = merged.sliceId(new ID(iclient, iclock), 1)
      mergedAttrs.forEach(a => {
        if (a.attrs != null) {
          composed.add(iclient, a.clock, a.len, a.attrs)
        }
      })
    }
  }
  compareIdMaps(merged, composed)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatRandomDiffing = tc => {
  const clients = 4
  const clockRange = 100
  const attrs = [1, 2, 3]
  const idset1 = createRandomIdMap(tc.prng, clients, clockRange, attrs)
  const idset2 = createRandomIdMap(tc.prng, clients, clockRange, attrs)
  const merged = idmap.mergeIdMaps([idset1, idset2])
  const e1 = idmap.diffIdMap(idset1, idset2)
  const e2 = idmap.diffIdMap(merged, idset2)
  compareIdMaps(e1, e2)
  const copy = YY.decodeIdMap(YY.encodeIdMap(e1))
  compareIdMaps(e1, copy)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatRandomDiffing2 = tc => {
  const clients = 4
  const clockRange = 100
  const attrs = [1, 2, 3]
  const idmap1 = createRandomIdMap(tc.prng, clients, clockRange, attrs)
  const idmap2 = createRandomIdMap(tc.prng, clients, clockRange, attrs)
  const idsExclude = createRandomIdSet(tc.prng, clients, clockRange)
  const merged = idmap.mergeIdMaps([idmap1, idmap2])
  const mergedExcluded = idmap.diffIdMap(merged, idsExclude)
  const e1 = idmap.diffIdMap(idmap1, idsExclude)
  const e2 = idmap.diffIdMap(idmap2, idsExclude)
  const excludedMerged = idmap.mergeIdMaps([e1, e2])
  compareIdMaps(mergedExcluded, excludedMerged)
  const copy = YY.decodeIdMap(YY.encodeIdMap(mergedExcluded))
  compareIdMaps(mergedExcluded, copy)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatRandomDeletes = tc => {
  const clients = 1
  const clockRange = 100
  const idset = createRandomIdMap(tc.prng, clients, clockRange, [])
  const client = Array.from(idset.clients.keys())[0]
  const clock = prng.int31(tc.prng, 0, clockRange)
  const len = prng.int31(tc.prng, 0, math.round((clockRange - clock) * 1.2)) // allow exceeding range to cover more edge cases
  const idsetOfDeletes = idmap.createIdMap()
  idsetOfDeletes.add(client, clock, len, [])
  const diffed = idmap.diffIdMap(idset, idsetOfDeletes)
  idset.delete(client, clock, len)
  for (let i = 0; i < len; i++) {
    t.assert(!idset.has(client, clock + i))
  }
  compareIdMaps(idset, diffed)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatRandomIntersects = tc => {
  const clients = 4
  const clockRange = 100
  const ids1 = createRandomIdMap(tc.prng, clients, clockRange, [1])
  const ids2 = createRandomIdMap(tc.prng, clients, clockRange, ['two'])
  const intersected = idmap.intersectMaps(ids1, ids2)
  for (let client = 0; client < clients; client++) {
    for (let clock = 0; clock < clockRange; clock++) {
      t.assert((ids1.has(client, clock) && ids2.has(client, clock)) === intersected.has(client, clock))
      /**
       * @type {Array<any>?}
       */
      const slice1 = ids1.slice(client, clock, 1)[0].attrs
      /**
       * @type {Array<any>?}
       */
      const slice2 = ids2.slice(client, clock, 1)[0].attrs
      /**
       * @type {Array<any>?}
       */
      const expectedAttrs = (slice1 != null && slice2 != null) ? slice1.concat(slice2) : null
      const attrs = intersected.slice(client, clock, 1)[0].attrs
      t.assert(attrs?.length === expectedAttrs?.length)
    }
  }
  const diffed1 = idmap.diffIdMap(ids1, ids2)
  const altDiffed1 = idmap.diffIdMap(ids1, intersected)
  compareIdMaps(diffed1, altDiffed1)
}

/**
 * @param {t.TestCase} tc
 */
export const testUserAttributionEncodingBenchmark = tc => {
  /**
   * @todo debug why this approach needs 30 bytes per item
   * @todo it should be possible to only use a single idmap and, in each attr entry, encode the diff
   * to the previous entries (e.g. remove a,b, insert c,d)
   */
  const attributions = createIdMap()
  let currentTime = time.getUnixTime()
  const ydoc = new YY.Doc()
  ydoc.on('afterTransaction', tr => {
    idmap.insertIntoIdMap(attributions, idmap.createIdMapFromIdSet(tr.insertSet, [createAttributionItem('insert', 'userX'), createAttributionItem('insertAt', currentTime)]))
    idmap.insertIntoIdMap(attributions, idmap.createIdMapFromIdSet(tr.deleteSet, [createAttributionItem('delete', 'userX'), createAttributionItem('deleteAt', currentTime)]))
    currentTime += 1
  })
  const ytext = ydoc.get()
  const N = 10000
  t.measureTime(`time to attribute ${N / 1000}k changes`, () => {
    for (let i = 0; i < N; i++) {
      if (i % 2 > 0 && ytext.length > 0) {
        const pos = prng.int31(tc.prng, 0, ytext.length)
        const delLen = prng.int31(tc.prng, 0, ytext.length - pos)
        ytext.delete(pos, delLen)
      } else {
        ytext.insert(prng.int31(tc.prng, 0, ytext.length), prng.word(tc.prng))
      }
    }
  })
  t.measureTime('time to encode attributions map', () => {
    /**
     * @todo I can optimize size by encoding only the differences to the prev item.
     */
    const encAttributions = idmap.encodeIdMap(attributions)
    t.info('encoded size: ' + encAttributions.byteLength)
    t.info('size per change: ' + math.floor((encAttributions.byteLength / N) * 100) / 100 + ' bytes')
  })
}
