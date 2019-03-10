import * as prng from 'lib0/prng.js'
import * as t from 'lib0/testing.js'
import { DeleteStore } from '../src/utils/DeleteStore.js'
import * as ID from '../src/utils/ID.js'

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
 * @return {Array<(null|number)>} Array of numbers indicating if array[i] is deleted (0), garbage collected (1), or undeleted (undefined).
 */
const dsToArray = ds => {
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

/**
 * @param {t.TestCase} tc
 */
export const testDeleteStore = tc => {
  t.describe('Integrity tests')
  const ds = new DeleteStore()
  ds.mark(ID.createID(0, 1), 1, false)
  ds.mark(ID.createID(0, 2), 1, false)
  ds.mark(ID.createID(0, 3), 1, false)
  t.compareArrays(dsToArray(ds), [null, 0, 0, 0])
  ds.mark(ID.createID(0, 2), 1, true)
  t.compareArrays(dsToArray(ds), [null, 0, 1, 0])
  ds.mark(ID.createID(0, 1), 1, true)
  t.compareArrays(dsToArray(ds), [null, 1, 1, 0])
  ds.mark(ID.createID(0, 3), 1, true)
  t.compareArrays(dsToArray(ds), [null, 1, 1, 1])
  ds.mark(ID.createID(0, 5), 1, true)
  ds.mark(ID.createID(0, 4), 1, true)
  t.compareArrays(dsToArray(ds), [null, 1, 1, 1, 1, 1])
  ds.mark(ID.createID(0, 0), 3, false)
  t.compareArrays(dsToArray(ds), [0, 0, 0, 1, 1, 1])
}

export const testRepeatDeleteStoreTests = tc => {
  const gen = tc.prng
  const ds = new DeleteStore()
  const dsArray = []
  for (let i = 0; i < 200; i++) {
    const pos = prng.int31(gen, 0, 10)
    const len = prng.int31(gen, 0, 4)
    const gc = prng.bool(gen)
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
  t.compareArrays(dsToArray(ds), dsArray)
  let size = 0
  let lastEl = null
  for (let i = 0; i < dsArray.length; i++) {
    let el = dsArray[i]
    if (lastEl !== el && el !== null) {
      size++
    }
    lastEl = el
  }
  t.assert(size === ds.length)
}
