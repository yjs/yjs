import * as t from 'lib0/testing'
import * as d from '../src/utils/DeleteSet.js'

/**
 * @param {Array<[number, number, number]>} ops
 */
const simpleConstructDs = ops => {
  const ds = new d.DeleteSet()
  ops.forEach(op => {
    d.addToDeleteSet(ds, op[0], op[1], op[2])
  })
  d.sortAndMergeDeleteSet(ds)
  return ds
}

/**
 * @param {d.DeleteSet} ds1
 * @param {d.DeleteSet} ds2
 */
const compareDs = (ds1, ds2) => {
  t.assert(ds1.clients.size === ds2.clients.size)
  ds1.clients.forEach((ranges1, clientid) => {
    const ranges2 = ds2.clients.get(clientid) ?? []
    t.assert(ranges1.length === ranges2?.length)
    for (let i = 0; i < ranges1.length; i++) {
      const d1 = ranges1[i]
      const d2 = ranges2[i]
      t.assert(d1.len === d2.len && d1.clock == d2.clock)
    }
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testDeletesetMerge = _tc => {
  t.group('filter out empty items (1))', () => {
    compareDs(
      simpleConstructDs([[0, 1, 0]]),
      simpleConstructDs([])
    )
  })
  t.group('filter out empty items (2))', () => {
    compareDs(
      simpleConstructDs([[0, 1, 0], [0, 2, 0]]),
      simpleConstructDs([])
    )
  })
  t.group('filter out empty items (3 - end))', () => {
    compareDs(
      simpleConstructDs([[0, 1, 1], [0, 2, 0]]),
      simpleConstructDs([[0, 1, 1]])
    )
  })
  t.group('filter out empty items (4 - middle))', () => {
    compareDs(
      simpleConstructDs([[0, 1, 1], [0, 2, 0], [0, 3, 1]]),
      simpleConstructDs([[0, 1, 1], [0, 3, 1]])
    )
  })
  t.group('filter out empty items (5 - beginning))', () => {
    compareDs(
      simpleConstructDs([[0, 1, 0], [0, 2, 1], [0, 3, 1]]),
      simpleConstructDs([[0, 2, 1], [0, 3, 1]])
    )
  })
  t.group('merge of overlapping deletes', () => {
    compareDs(
      simpleConstructDs([[0, 1, 2], [0, 0, 2]]),
      simpleConstructDs([[0, 0, 3]])
    )
  })
  t.group('construct without hole', () => {
    compareDs(
      simpleConstructDs([[0, 1, 2], [0, 3, 1]]),
      simpleConstructDs([[0, 1, 3]])
    )
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testDeletesetDiffing = _tc => {
  t.group('simple case (1))', () => {
    compareDs(
      d.diffDeleteSet(
        simpleConstructDs([[0, 1, 1], [0, 3, 1]]),
        simpleConstructDs([[0, 3, 1]])
      ),
      simpleConstructDs([[0, 1, 1]])
    )
  })
  t.group('subset left', () => {
    compareDs(
      d.diffDeleteSet(
        simpleConstructDs([[0, 1, 3]]),
        simpleConstructDs([[0, 1, 1]])
      ),
      simpleConstructDs([[0, 2, 2]])
    )
  })
  t.group('subset right', () => {
    compareDs(
      d.diffDeleteSet(
        simpleConstructDs([[0, 1, 3]]),
        simpleConstructDs([[0, 3, 1]])
      ),
      simpleConstructDs([[0, 1, 2]])
    )
  })
  t.group('subset middle', () => {
    compareDs(
      d.diffDeleteSet(
        simpleConstructDs([[0, 1, 3]]),
        simpleConstructDs([[0, 2, 1]])
      ),
      simpleConstructDs([[0, 1, 1], [0, 3, 1]])
    )
  })
  t.group('overlapping left', () => {
    compareDs(
      d.diffDeleteSet(
        simpleConstructDs([[0, 1, 3]]),
        simpleConstructDs([[0, 0, 2]])
      ),
      simpleConstructDs([[0, 2, 2]])
    )
  })
  t.group('overlapping right', () => {
    compareDs(
      d.diffDeleteSet(
        simpleConstructDs([[0, 1, 3]]),
        simpleConstructDs([[0, 3, 5]])
      ),
      simpleConstructDs([[0, 1, 2]])
    )
  })
  t.group('overlapping completely', () => {
    compareDs(
      d.diffDeleteSet(
        simpleConstructDs([[0, 1, 3]]),
        simpleConstructDs([[0, 0, 5]])
      ),
      simpleConstructDs([])
    )
  })
  t.group('overlapping into new range', () => {
    compareDs(
      d.diffDeleteSet(
        simpleConstructDs([[0, 1, 3], [0, 5, 2]]),
        simpleConstructDs([[0, 0, 6]])
      ),
      simpleConstructDs([[0, 6, 1]])
    )
  })
}
