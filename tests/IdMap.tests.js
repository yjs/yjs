import * as t from 'lib0/testing'
import * as am from '../src/utils/IdMap.js'
import { compareIdmaps, createIdMap, ID, createRandomIdSet, createRandomIdMap, createAttribution } from './testHelper.js'
import * as YY from '../src/internals.js'

/**
 * @template T
 * @param {Array<[number, number, number, Array<T>]>} ops
 */
const simpleConstructAttrs = ops => {
  const attrs = createIdMap()
  ops.forEach(op => {
    attrs.add(op[0], op[1], op[2], op[3].map(v => createAttribution('', v)))
  })
  return attrs
}

/**
 * @param {t.TestCase} _tc
 */
export const testAmMerge = _tc => {
  const attrs = [42]
  t.group('filter out empty items (1))', () => {
    compareIdmaps(
      simpleConstructAttrs([[0, 1, 0, attrs]]),
      simpleConstructAttrs([])
    )
  })
  t.group('filter out empty items (2))', () => {
    compareIdmaps(
      simpleConstructAttrs([[0, 1, 0, attrs], [0, 2, 0, attrs]]),
      simpleConstructAttrs([])
    )
  })
  t.group('filter out empty items (3 - end))', () => {
    compareIdmaps(
      simpleConstructAttrs([[0, 1, 1, attrs], [0, 2, 0, attrs]]),
      simpleConstructAttrs([[0, 1, 1, attrs]])
    )
  })
  t.group('filter out empty items (4 - middle))', () => {
    compareIdmaps(
      simpleConstructAttrs([[0, 1, 1, attrs], [0, 2, 0, attrs], [0, 3, 1, attrs]]),
      simpleConstructAttrs([[0, 1, 1, attrs], [0, 3, 1, attrs]])
    )
  })
  t.group('filter out empty items (5 - beginning))', () => {
    compareIdmaps(
      simpleConstructAttrs([[0, 1, 0, attrs], [0, 2, 1, attrs], [0, 3, 1, attrs]]),
      simpleConstructAttrs([[0, 2, 1, attrs], [0, 3, 1, attrs]])
    )
  })
  t.group('merge of overlapping id ranges', () => {
    compareIdmaps(
      simpleConstructAttrs([[0, 1, 2, attrs], [0, 0, 2, attrs]]),
      simpleConstructAttrs([[0, 0, 3, attrs]])
    )
  })
  t.group('construct without hole', () => {
    compareIdmaps(
      simpleConstructAttrs([[0, 1, 2, attrs], [0, 3, 1, attrs]]),
      simpleConstructAttrs([[0, 1, 3, attrs]])
    )
  })
  t.group('no merge of overlapping id ranges with different attributes', () => {
    compareIdmaps(
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
   * @type {Array<am.IdMap<number>>}
   */
  const sets = []
  for (let i = 0; i < 3; i++) {
    sets.push(createRandomIdMap(tc.prng, clients, clockRange, [1, 2, 3]))
  }
  const merged = am.mergeIdMaps(sets)
  const mergedReverse = am.mergeIdMaps(sets.reverse())
  compareIdmaps(merged, mergedReverse)
  const composed = am.createIdMap()
  for (let iclient = 0; iclient < clients; iclient++) {
    for (let iclock = 0; iclock < clockRange + 42; iclock++) {
      const mergedHas = merged.has(new ID(iclient, iclock))
      const oneHas = sets.some(ids => ids.has(new ID(iclient, iclock)))
      t.assert(mergedHas === oneHas)
      const mergedAttrs = merged.slice(new ID(iclient, iclock), 1)
      if (mergedAttrs) {
        mergedAttrs.forEach(a => {
          composed.add(iclient, a.clock, a.len, a.attrs)
        })
      }
    }
  }
  compareIdmaps(merged, composed)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatRandomDiffing = tc => {
  const clients = 4
  const clockRange = 100
  const attrs = [1, 2, 3]
  const ds1 = createRandomIdMap(tc.prng, clients, clockRange, attrs)
  const ds2 = createRandomIdMap(tc.prng, clients, clockRange, attrs)
  const merged = am.mergeIdMaps([ds1, ds2])
  const e1 = am.diffIdMap(ds1, ds2)
  const e2 = am.diffIdMap(merged, ds2)
  compareIdmaps(e1, e2)
  const copy = YY.decodeIdMap(YY.encodeIdMap(e1))
  compareIdmaps(e1, copy)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatRandomDiffing2 = tc => {
  const clients = 4
  const clockRange = 100
  const attrs = [1, 2, 3]
  const am1 = createRandomIdMap(tc.prng, clients, clockRange, attrs)
  const am2 = createRandomIdMap(tc.prng, clients, clockRange, attrs)
  const idsExclude = createRandomIdSet(tc.prng, clients, clockRange)
  const merged = am.mergeIdMaps([am1, am2])
  const mergedExcluded = am.diffIdMap(merged, idsExclude)
  const e1 = am.diffIdMap(am1, idsExclude)
  const e2 = am.diffIdMap(am2, idsExclude)
  const excludedMerged = am.mergeIdMaps([e1, e2])
  compareIdmaps(mergedExcluded, excludedMerged)
  const copy = YY.decodeIdMap(YY.encodeIdMap(mergedExcluded))
  compareIdmaps(mergedExcluded, copy)
}
