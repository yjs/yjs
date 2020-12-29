import * as t from 'lib0/testing.js'
import { init, compare } from './testHelper.js' // eslint-disable-line
import * as Y from '../src/index.js'

const encV1 = {
  mergeUpdates: Y.mergeUpdates,
  encodeStateAsUpdate: Y.encodeStateAsUpdate,
  applyUpdate: Y.applyUpdate,
  logUpdate: Y.logUpdate,
  updateEventName: 'update'
}

const encV2 = {
  mergeUpdates: Y.mergeUpdatesV2,
  encodeStateAsUpdate: Y.encodeStateAsUpdateV2,
  applyUpdate: Y.applyUpdateV2,
  logUpdate: Y.logUpdateV2,
  updateEventName: 'updateV2'
}

const encoders = [encV1, encV2]

/**
 * @param {Array<Y.Doc>} users
 * @param {encV1 | encV2} enc
 */
const fromUpdates = (users, enc) => {
  const updates = users.map(user =>
    enc.encodeStateAsUpdate(user)
  )
  const ydoc = new Y.Doc()
  enc.applyUpdate(ydoc, enc.mergeUpdates(updates))
  return ydoc
}

/**
 * @param {t.TestCase} tc
 */
export const testMergeUpdates = tc => {
  const { users, array0, array1 } = init(tc, { users: 3 })

  array0.insert(0, [1])
  array1.insert(0, [2])

  compare(users)
  encoders.forEach(enc => {
    const merged = fromUpdates(users, enc)
    t.compareArrays(array0.toArray(), merged.getArray('array').toArray())
  })
}

/**
 * @param {Y.Doc} ydoc
 * @param {Array<Uint8Array>} updates - expecting at least 4 updates
 * @param {encV1 | encV2} enc
 */
const checkUpdateCases = (ydoc, updates, enc) => {
  const cases = []

  // Case 1: Simple case, simply merge everything
  cases.push(enc.mergeUpdates(updates))

  // Case 2: Overlapping updates
  cases.push(enc.mergeUpdates([
    enc.mergeUpdates(updates.slice(2)),
    enc.mergeUpdates(updates.slice(0, 2))
  ]))

  // Case 3: Overlapping updates
  cases.push(enc.mergeUpdates([
    enc.mergeUpdates(updates.slice(2)),
    enc.mergeUpdates(updates.slice(1, 3)),
    updates[0]
  ]))

  // Case 4: Separated updates (containing skips)
  cases.push(enc.mergeUpdates([
    enc.mergeUpdates([updates[0], updates[2]]),
    enc.mergeUpdates([updates[1], updates[3]]),
    enc.mergeUpdates(updates.slice(4))
  ]))

  // Case 5: overlapping with many duplicates
  cases.push(enc.mergeUpdates(cases))

  const targetState = enc.encodeStateAsUpdate(ydoc)
  t.info('Target State: ')
  enc.logUpdate(targetState)

  cases.forEach((updates, i) => {
    t.info('State Case $' + i + ':')
    enc.logUpdate(updates)
    const merged = new Y.Doc()
    enc.applyUpdate(merged, updates)
    t.compareArrays(merged.getArray().toArray(), ydoc.getArray().toArray())
  })
}

/**
 * @param {t.TestCase} tc
 */
export const testMergeUpdates1 = tc => {
  encoders.forEach((enc, i) => {
    t.info(`Using V${i + 1} encoder.`)
    const ydoc = new Y.Doc({ gc: false })
    const updates = /** @type {Array<Uint8Array>} */ ([])
    ydoc.on(enc.updateEventName, update => { updates.push(update) })

    const array = ydoc.getArray()
    array.insert(0, [1])
    array.insert(0, [2])
    array.insert(0, [3])
    array.insert(0, [4])

    checkUpdateCases(ydoc, updates, enc)
  })
}

/**
 * @param {t.TestCase} tc
 */
export const testMergeUpdates2 = tc => {
  encoders.forEach((enc, i) => {
    t.info(`Using V${i + 1} encoder.`)
    const ydoc = new Y.Doc({ gc: false })
    const updates = /** @type {Array<Uint8Array>} */ ([])
    ydoc.on(enc.updateEventName, update => { updates.push(update) })

    const array = ydoc.getArray()
    array.insert(0, [1, 2])
    array.delete(1, 1)
    array.insert(0, [3, 4])
    array.delete(1, 2)

    checkUpdateCases(ydoc, updates, enc)
  })
}

/**
 * @todo be able to apply Skip structs to Yjs docs
 */
