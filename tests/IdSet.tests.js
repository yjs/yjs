import * as t from 'lib0/testing'
import * as d from '../src/utils/IdSet.js'
import * as math from 'lib0/math'
import * as prng from 'lib0/prng'
import { compareIdSets, createRandomIdSet, ID } from './testHelper.js'

/**
 * @param {Array<[number, number, number]>} ops
 */
const simpleConstructIdSet = ops => {
  const idset = d.createIdSet()
  ops.forEach(op => {
    d.addToIdSet(idset, op[0], op[1], op[2])
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
        d.addToIdSet(composed, iclient, iclock, 1)
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
export const testrepeatRandomIntersects = tc => {
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
