import * as t from 'lib0/testing.js'
import { init, compare } from './testHelper.js' // eslint-disable-line
import * as Y from '../src/index.js'

const useV2 = true

const encodeStateAsUpdate = useV2 ? Y.encodeStateAsUpdateV2 : Y.encodeStateAsUpdate
const mergeUpdates = useV2 ? Y.mergeUpdatesV2 : Y.mergeUpdates
const applyUpdate = useV2 ? Y.applyUpdateV2 : Y.applyUpdate
const logUpdate = useV2 ? Y.logUpdateV2 : Y.logUpdate
const updateEventName = useV2 ? 'updateV2' : 'update'

/**
 * @param {Array<Y.Doc>} users
 */
const fromUpdates = users => {
  const updates = users.map(user =>
    encodeStateAsUpdate(user)
  )
  const ydoc = new Y.Doc()
  applyUpdate(ydoc, mergeUpdates(updates))
  return ydoc
}

/**
 * @param {t.TestCase} tc
 */
export const testMergeUpdates = tc => {
  const { users, array0, array1 } = init(tc, { users: 3 })

  array0.insert(0, [1])
  array1.insert(0, [2])

  const merged = fromUpdates(users)
  compare(users)
  t.compareArrays(array0.toArray(), merged.getArray('array').toArray())
}

/**
 * @param {Y.Doc} ydoc
 * @param {Array<Uint8Array>} updates - expecting at least 4 updates
 */
const checkUpdateCases = (ydoc, updates) => {
  const cases = []

  // Case 1: Simple case, simply merge everything
  cases.push(mergeUpdates(updates))

  // Case 2: Overlapping updates
  cases.push(mergeUpdates([
    mergeUpdates(updates.slice(2)),
    mergeUpdates(updates.slice(0, 2))
  ]))

  // Case 3: Overlapping updates
  cases.push(mergeUpdates([
    mergeUpdates(updates.slice(2)),
    mergeUpdates(updates.slice(1, 3)),
    updates[0]
  ]))

  // Case 4: Separated updates (containing skips)
  cases.push(mergeUpdates([
    mergeUpdates([updates[0], updates[2]]),
    mergeUpdates([updates[1], updates[3]]),
    mergeUpdates(updates.slice(4))
  ]))

  // Case 5: overlapping with many duplicates
  cases.push(mergeUpdates(cases))

  const targetState = encodeStateAsUpdate(ydoc)
  t.info('Target State: ')
  logUpdate(targetState)

  cases.forEach((updates, i) => {
    t.info('State Case $' + i + ':')
    logUpdate(updates)
    const merged = new Y.Doc()
    applyUpdate(merged, updates)
    t.compareArrays(merged.getArray().toArray(), ydoc.getArray().toArray())
  })
}

/**
 * @param {t.TestCase} tc
 */
export const testMergeUpdates1 = tc => {
  const ydoc = new Y.Doc({ gc: false })
  const updates = /** @type {Array<Uint8Array>} */ ([])
  ydoc.on(updateEventName, update => { updates.push(update) })

  const array = ydoc.getArray()
  array.insert(0, [1])
  array.insert(0, [2])
  array.insert(0, [3])
  array.insert(0, [4])

  checkUpdateCases(ydoc, updates)
}

/**
 * @param {t.TestCase} tc
 */
export const testMergeUpdates2 = tc => {
  const ydoc = new Y.Doc({ gc: false })
  const updates = /** @type {Array<Uint8Array>} */ ([])
  ydoc.on(updateEventName, update => { updates.push(update) })

  const array = ydoc.getArray()
  array.insert(0, [1, 2])
  array.delete(1, 1)
  array.insert(0, [3, 4])
  array.delete(1, 2)

  checkUpdateCases(ydoc, updates)
}

/**
 * @todo be able to apply Skip structs to Yjs docs
 */
