import * as t from 'lib0/testing'
import * as am from '../src/utils/AttributionManager.js'
import { compareAttributionManagers, createAttributionManager, ID, createRandomIdSet, createRandomAttributionManager } from './testHelper.js'

/**
 * @template T
 * @param {Array<[number, number, number, Array<T>]>} ops
 */
const simpleConstructAttrs = ops => {
  const attrs = createAttributionManager()
  ops.forEach(op => {
    attrs.add(op[0], op[1], op[2], op[3])
  })
  return attrs
}

/**
 * @param {t.TestCase} _tc
 */
export const testAmMerge = _tc => {
  const attrs = [42]
  t.group('filter out empty items (1))', () => {
    compareAttributionManagers(
      simpleConstructAttrs([[0, 1, 0, attrs]]),
      simpleConstructAttrs([])
    )
  })
  t.group('filter out empty items (2))', () => {
    compareAttributionManagers(
      simpleConstructAttrs([[0, 1, 0, attrs], [0, 2, 0, attrs]]),
      simpleConstructAttrs([])
    )
  })
  t.group('filter out empty items (3 - end))', () => {
    compareAttributionManagers(
      simpleConstructAttrs([[0, 1, 1, attrs], [0, 2, 0, attrs]]),
      simpleConstructAttrs([[0, 1, 1, attrs]])
    )
  })
  t.group('filter out empty items (4 - middle))', () => {
    compareAttributionManagers(
      simpleConstructAttrs([[0, 1, 1, attrs], [0, 2, 0, attrs], [0, 3, 1, attrs]]),
      simpleConstructAttrs([[0, 1, 1, attrs], [0, 3, 1, attrs]])
    )
  })
  t.group('filter out empty items (5 - beginning))', () => {
    compareAttributionManagers(
      simpleConstructAttrs([[0, 1, 0, attrs], [0, 2, 1, attrs], [0, 3, 1, attrs]]),
      simpleConstructAttrs([[0, 2, 1, attrs], [0, 3, 1, attrs]])
    )
  })
  t.group('merge of overlapping id ranges', () => {
    compareAttributionManagers(
      simpleConstructAttrs([[0, 1, 2, attrs], [0, 0, 2, attrs]]),
      simpleConstructAttrs([[0, 0, 3, attrs]])
    )
  })
  t.group('construct without hole', () => {
    compareAttributionManagers(
      simpleConstructAttrs([[0, 1, 2, attrs], [0, 3, 1, attrs]]),
      simpleConstructAttrs([[0, 1, 3, attrs]])
    )
  })
  t.group('no merge of overlapping id ranges with different attributes', () => {
    compareAttributionManagers(
      simpleConstructAttrs([[0, 1, 2, [1]], [0, 0, 2, [2]]]),
      simpleConstructAttrs([[0, 0, 1, [2]], [0, 1, 1, [1, 2]], [0, 2, 1, [1]]])
    )
  })
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatMergingMultipleAttrManagers = tc => {
  const clients = 4
  const clockRange = 5
  /**
   * @type {Array<am.AttributionManager<number>>}
   */
  const sets = []
  for (let i = 0; i < 3; i++) {
    sets.push(createRandomAttributionManager(tc.prng, clients, clockRange, [1, 2, 3]))
  }
  const merged = am.mergeAttributionManagers(sets)
  const mergedReverse = am.mergeAttributionManagers(sets.reverse())
  compareAttributionManagers(merged, mergedReverse)
  const composed = am.createAttributionManager()
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
  compareAttributionManagers(merged, composed)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatRandomDiffing = tc => {
  const clients = 4
  const clockRange = 100
  const attrs = [1, 2, 3]
  const ds1 = createRandomAttributionManager(tc.prng, clients, clockRange, attrs)
  const ds2 = createRandomAttributionManager(tc.prng, clients, clockRange, attrs)
  const merged = am.mergeAttributionManagers([ds1, ds2])
  const e1 = am.diffAttributionManager(ds1, ds2)
  const e2 = am.diffAttributionManager(merged, ds2)
  compareAttributionManagers(e1, e2)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatRandomDiffing2 = tc => {
  const clients = 4
  const clockRange = 100
  const attrs = [1, 2, 3]
  const am1 = createRandomAttributionManager(tc.prng, clients, clockRange, attrs)
  const am2 = createRandomAttributionManager(tc.prng, clients, clockRange, attrs)
  const idsExclude = createRandomIdSet(tc.prng, clients, clockRange)
  const merged = am.mergeAttributionManagers([am1, am2])
  const mergedExcluded = am.diffAttributionManager(merged, idsExclude)
  const e1 = am.diffAttributionManager(am1, idsExclude)
  const e2 = am.diffAttributionManager(am2, idsExclude)
  const excludedMerged = am.mergeAttributionManagers([e1, e2])
  compareAttributionManagers(mergedExcluded, excludedMerged)
}
