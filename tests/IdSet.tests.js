import * as t from 'lib0/testing'
import * as d from '../src/utils/IdSet.js'
import * as prng from 'lib0/prng'
import * as math from 'lib0/math'

/**
 * @param {Array<[number, number, number]>} ops
 */
const simpleConstructIdSet = ops => {
  const ds = d.createIdSet()
  ops.forEach(op => {
    d.addToIdSet(ds, op[0], op[1], op[2])
  })
  return ds
}

/**
 * @param {d.IdSet} idSet1
 * @param {d.IdSet} idSet2
 */
const compareIdSets = (idSet1, idSet2) => {
  if (idSet1.clients.size !== idSet2.clients.size) return false
  for (const [client, _items1] of idSet1.clients.entries()) {
    const items1 = _items1.getIds()
    const items2 = idSet2.clients.get(client)?.getIds()
    t.assert(items2 !== undefined && items1.length === items2.length)
    for (let i = 0; i < items1.length; i++) {
      const di1 = items1[i]
      const di2 = /** @type {Array<d.IdRange>} */ (items2)[i]
      t.assert(di1.clock === di2.clock && di1.len === di2.len)
    }
  }
  return true
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
      d.diffIdSets(
        simpleConstructIdSet([[0, 1, 1], [0, 3, 1]]),
        simpleConstructIdSet([[0, 3, 1]])
      ),
      simpleConstructIdSet([[0, 1, 1]])
    )
  })
  t.group('subset left', () => {
    compareIdSets(
      d.diffIdSets(
        simpleConstructIdSet([[0, 1, 3]]),
        simpleConstructIdSet([[0, 1, 1]])
      ),
      simpleConstructIdSet([[0, 2, 2]])
    )
  })
  t.group('subset right', () => {
    compareIdSets(
      d.diffIdSets(
        simpleConstructIdSet([[0, 1, 3]]),
        simpleConstructIdSet([[0, 3, 1]])
      ),
      simpleConstructIdSet([[0, 1, 2]])
    )
  })
  t.group('subset middle', () => {
    compareIdSets(
      d.diffIdSets(
        simpleConstructIdSet([[0, 1, 3]]),
        simpleConstructIdSet([[0, 2, 1]])
      ),
      simpleConstructIdSet([[0, 1, 1], [0, 3, 1]])
    )
  })
  t.group('overlapping left', () => {
    compareIdSets(
      d.diffIdSets(
        simpleConstructIdSet([[0, 1, 3]]),
        simpleConstructIdSet([[0, 0, 2]])
      ),
      simpleConstructIdSet([[0, 2, 2]])
    )
  })
  t.group('overlapping right', () => {
    compareIdSets(
      d.diffIdSets(
        simpleConstructIdSet([[0, 1, 3]]),
        simpleConstructIdSet([[0, 3, 5]])
      ),
      simpleConstructIdSet([[0, 1, 2]])
    )
  })
  t.group('overlapping completely', () => {
    compareIdSets(
      d.diffIdSets(
        simpleConstructIdSet([[0, 1, 3]]),
        simpleConstructIdSet([[0, 0, 5]])
      ),
      simpleConstructIdSet([])
    )
  })
  t.group('overlapping into new range', () => {
    compareIdSets(
      d.diffIdSets(
        simpleConstructIdSet([[0, 1, 3], [0, 5, 2]]),
        simpleConstructIdSet([[0, 0, 6]])
      ),
      simpleConstructIdSet([[0, 6, 1]])
    )
  })
}

/**
 * @param {prng.PRNG} gen
 * @param {number} clients
 * @param {number} clockRange (max clock - exclusive - by each client)
 */
const createRandomDiffSet = (gen, clients, clockRange) => {
  const maxOpLen = 5
  const numOfOps = math.ceil((clients * clockRange) / maxOpLen)
  const ds = d.createIdSet()
  for (let i = 0; i < numOfOps; i++) {
    const client = prng.uint32(gen, 0, clients - 1)
    const clockStart = prng.uint32(gen, 0, clockRange)
    const len = prng.uint32(gen, 0, clockRange - clockStart)
    d.addToIdSet(ds, client, clockStart, len)
  }
  if (ds.clients.size === clients && clients > 1 && prng.bool(gen)) {
    ds.clients.delete(prng.uint32(gen, 0, clients))
  }
  return ds
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatRandomDiffing = tc => {
  const clients = 4
  const clockRange = 100
  const ds1 = createRandomDiffSet(tc.prng, clients, clockRange)
  const ds2 = createRandomDiffSet(tc.prng, clients, clockRange)
  const merged = d.mergeIdSets([ds1, ds2])
  const e1 = d.diffIdSets(ds1, ds2)
  const e2 = d.diffIdSets(merged, ds2)
  compareIdSets(e1, e2)
}
