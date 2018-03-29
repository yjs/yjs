import { test } from '../node_modules/cutest/cutest.mjs'
import simpleDiff from '../src/Util/simpleDiff.js'
import Chance from 'chance'
import DeleteStore from '../src/Store/DeleteStore.js'
import ID from '../src/Util/ID/ID.js'

/**
 * Converts a DS to an array of length 10.
 *
 * @example
 * const ds = new DeleteStore()
 * ds.mark(new ID(0, 0), 1, false)
 * ds.mark(new ID(0, 1), 1, true)
 * ds.mark(new ID(0, 3), 1, false)
 * dsToArray(ds) // => [0, 1, undefined, 0]
 *
 * @return {Array<(undefined|number)>} Array of numbers indicating if array[i] is deleted (0), garbage collected (1), or undeleted (undefined).
 */
function dsToArray (ds) {
  const array = []
  let i = 0
  ds.iterate(null, null, function (n) {
    // fill with null
    while (i < n._id.clock) {
      array[i++] = null
    }
    while (i < n._id.clock + n.len) {
      array[i++] = n.gc ? 1 : 0
    }
  })
  return array
}

test('DeleteStore', async function ds1 (t) {
  const ds = new DeleteStore()
  ds.mark(new ID(0, 1), 1, false)
  ds.mark(new ID(0, 2), 1, false)
  ds.mark(new ID(0, 3), 1, false)
  t.compare(dsToArray(ds), [null, 0, 0, 0])
  ds.mark(new ID(0, 2), 1, true)
  t.compare(dsToArray(ds), [null, 0, 1, 0])
  ds.mark(new ID(0, 1), 1, true)
  t.compare(dsToArray(ds), [null, 1, 1, 0])
  ds.mark(new ID(0, 3), 1, true)
  t.compare(dsToArray(ds), [null, 1, 1, 1])
  ds.mark(new ID(0, 5), 1, true)
  ds.mark(new ID(0, 4), 1, true)
  t.compare(dsToArray(ds), [null, 1, 1, 1, 1, 1])
  ds.mark(new ID(0, 0), 3, false)
  t.compare(dsToArray(ds), [0, 0, 0, 1, 1, 1])
})

test('random DeleteStore tests', async function randomDS (t) {
  const chance = new Chance(t.getSeed() * 1000000000)
  const ds = new DeleteStore()
  const dsArray = []
  for (let i = 0; i < 200; i++) {
    const pos = chance.integer({ min: 0, max: 10 })
    const len = chance.integer({ min: 0, max: 4 })
    const gc = chance.bool()
    ds.mark(new ID(0, pos), len, gc)
    for (let j = 0; j < len; j++) {
      dsArray[pos + j] = gc ? 1 : 0
    }
  }
  // fill empty fields
  for (let i = 0; i < dsArray.length; i++) {
    if (dsArray[i] !== 0 && dsArray[i] !== 1) {
      dsArray[i] = null
    }
  }
  t.compare(dsToArray(ds), dsArray, 'expected DS result')
  let size = 0
  let lastEl = null
  for (let i = 0; i < dsArray.length; i++) {
    let el = dsArray[i]
    if (lastEl !== el && el !== null) {
      size++
    }
    lastEl = el
  }
  t.compare(size, ds.length, 'expected ds size')
})
