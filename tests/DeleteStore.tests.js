import { test } from 'cutest'
import * as random from '../lib/prng/prng.js'
import { DeleteStore } from '../utils/DeleteStore.js'
import * as ID from '../utils/ID.js'

/**
 * Converts a DS to an array of length 10.
 *
 * @example
 * const ds = new DeleteStore()
 * ds.mark(ID.createID(0, 0), 1, false)
 * ds.mark(ID.createID(0, 1), 1, true)
 * ds.mark(ID.createID(0, 3), 1, false)
 * dsToArray(ds) // => [0, 1, undefined, 0]
 *
 * @return {Array<(undefined|number)>} Array of numbers indicating if array[i] is deleted (0), garbage collected (1), or undeleted (undefined).
 */
function dsToArray (ds) {
  const array = []
  let i = 0
  ds.iterate(null, null, n => {
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
  ds.mark(ID.createID(0, 1), 1, false)
  ds.mark(ID.createID(0, 2), 1, false)
  ds.mark(ID.createID(0, 3), 1, false)
  t.compare(dsToArray(ds), [null, 0, 0, 0])
  ds.mark(ID.createID(0, 2), 1, true)
  t.compare(dsToArray(ds), [null, 0, 1, 0])
  ds.mark(ID.createID(0, 1), 1, true)
  t.compare(dsToArray(ds), [null, 1, 1, 0])
  ds.mark(ID.createID(0, 3), 1, true)
  t.compare(dsToArray(ds), [null, 1, 1, 1])
  ds.mark(ID.createID(0, 5), 1, true)
  ds.mark(ID.createID(0, 4), 1, true)
  t.compare(dsToArray(ds), [null, 1, 1, 1, 1, 1])
  ds.mark(ID.createID(0, 0), 3, false)
  t.compare(dsToArray(ds), [0, 0, 0, 1, 1, 1])
})

test('random DeleteStore tests', async function randomDS (t) {
  const prng = random.createPRNG(t.getSeed())
  const ds = new DeleteStore()
  const dsArray = []
  for (let i = 0; i < 200; i++) {
    const pos = random.int32(prng, 0, 10)
    const len = random.int32(prng, 0, 4)
    const gc = random.bool(prng)
    ds.mark(ID.createID(0, pos), len, gc)
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
