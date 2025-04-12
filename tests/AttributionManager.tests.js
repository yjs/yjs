import * as t from 'lib0/testing'
import * as am from '../src/utils/AttributionManager.js'
import * as prng from 'lib0/prng'
import * as math from 'lib0/math'
import { compareAttributionManagers, createAttributionManager, ID } from './testHelper.js'

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
 * @template T
 * @param {prng.PRNG} gen
 * @param {number} clients
 * @param {number} clockRange (max clock - exclusive - by each client)
 * @param {Array<T>} attrChoices (max clock - exclusive - by each client)
 * @return {am.AttributionManager<T>}
 */
const createRandomAttributionManager = (gen, clients, clockRange, attrChoices) => {
  const maxOpLen = 5
  const numOfOps = math.ceil((clients * clockRange) / maxOpLen)
  const attrMngr = createAttributionManager()
  for (let i = 0; i < numOfOps; i++) {
    const client = prng.uint32(gen, 0, clients - 1)
    const clockStart = prng.uint32(gen, 0, clockRange)
    const len = prng.uint32(gen, 0, clockRange - clockStart)
    const attrs = [prng.oneOf(gen, attrChoices)]
    if (prng.bool(gen)) {
      attrs.push(prng.oneOf(gen, attrChoices))
    }
    attrMngr.add(client, clockStart, len, attrs)
  }
  return attrMngr
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
      simpleConstructAttrs([[0, 0, 1, [2]], [0, 1, 1, [1, 2]], [0, 2, 1, [2]]])
    )
  })
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatMergingMultipleAttrManagers = tc => {
  const clients = 4
  const clockRange = 100
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

