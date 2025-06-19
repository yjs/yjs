import * as t from 'lib0/testing'
import * as Y from '../src/index.js'

/**
 * @param {() => void} f function that should throw
 * @returns {boolean}
 */
const shouldThrow = (f) => {
  try {
    f()
    return false
  } catch (/** @type {any} */ e) {
    console.log('Error thrown:', e?.message)
    return true
  }
}

/**
 * @param {t.TestCase} _tc
 */
export const testShouldntMergeUpdatesWithTooManyStructs = (_tc) => {
  // Binary with 4398046511101 structs.
  const buf = new Uint8Array([
    0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 1, 2, 0, 0, 22, 2, 0, 0, 1, 253, 255, 255,
    255, 255, 127, 0, 0
  ])

  t.assert(shouldThrow(() => {
    const update = Y.encodeStateAsUpdateV2(new Y.Doc())
    Y.mergeUpdatesV2([update, buf])
  }))
}

/**
 * @param {t.TestCase} _tc
 */
export const testShouldntMergeUpdatesWithTooManyUpdatesV1 = (_tc) => {
  // Binary with 265828 updates.
  const buf = new Uint8Array([
    228, 156, 16, 0, 5, 255, 255, 5, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 237,
    0, 0, 0, 1, 1, 0, 254, 184, 194, 233, 173, 135, 217, 18, 0, 0, 1, 1,
    255, 237, 246
  ])
  const update = Y.encodeStateAsUpdate(new Y.Doc())
  t.assert(shouldThrow(() => {
    Y.mergeUpdates([update, buf])
  }))
}

/**
 * @param {t.TestCase} _tc
 */
export const testShouldntMergeUpdatesWithTooManyUpdatesV2 = (_tc) => {
  // Binary with 7658324286 updates.
  const buf = new Uint8Array([
    228, 149, 0, 0, 1, 24, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 237, 1, 190,
    130, 227, 195, 28, 1, 2, 228, 149, 0, 0, 1, 24, 0, 0, 1, 24, 0, 0,
    1, 0, 1, 237, 0
  ])
  const update = Y.encodeStateAsUpdateV2(new Y.Doc())

  t.assert(shouldThrow(() => {
    Y.mergeUpdatesV2([update, buf])
  }))
}

/**
 * @param {t.TestCase} _tc
 */
export const testShouldntAcceptTooLargeGCItems = (_tc) => {
  // Update with a GC item of length 553253.
  const buf = new Uint8Array([
    143, 1, 128, 0, 0, 0, 1, 170, 1, 0, 1, 2, 0, 0, 22, 2, 0, 229, 196,
    67, 20, 231, 166, 139, 147, 174, 181, 253, 93, 232, 38, 154, 138,
    89, 0, 49, 213, 15, 18, 1, 48, 0, 0, 0
  ])
  const update = Y.encodeStateAsUpdateV2(new Y.Doc())
  t.assert(shouldThrow(() => {
    Y.mergeUpdatesV2([update, buf])
  }))
}

export const testShouldntApplyUpdatesOverLimit = () => {
  // Binary with 267854847 structs in one update.
  const buf = new Uint8Array([
    0, 1, 35, 0, 0, 0, 1, 2, 129, 0, 0, 16, 0, 199, 220, 0, 196, 122, 128,
    0, 65, 171, 234, 214, 0, 1, 0, 0, 1, 0, 0, 132, 0, 0, 16, 255, 199, 220,
    255, 0, 0, 0
  ])
  t.assert(shouldThrow(() => {
    Y.applyUpdateV2(new Y.Doc(), buf)
  }))
}
