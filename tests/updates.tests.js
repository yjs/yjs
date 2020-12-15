import * as t from 'lib0/testing.js'
import { init, compare } from './testHelper.js' // eslint-disable-line
import * as Y from '../src/index.js'

/**
 * @param {Array<Y.Doc>} users
 */
const fromUpdates = users => {
  const updates = users.map(user =>
    Y.encodeStateAsUpdate(user)
  )
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, Y.mergeUpdates(updates))
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
 * @param {t.TestCase} tc
 */
export const testMergeUpdatesWrongOrder = tc => {
  const ydoc = new Y.Doc()
  const updates = /** @type {Array<Uint8Array>} */ ([])
  ydoc.on('update', update => { updates.push(update) })

  const array = ydoc.getArray()
  array.insert(0, [1])
  array.insert(0, [2])
  array.insert(0, [3])
  array.insert(0, [4])

  const wrongOrder = Y.mergeUpdates([
    Y.mergeUpdates(updates.slice(2)),
    Y.mergeUpdates(updates.slice(0, 2))
  ])
  const overlapping = Y.mergeUpdates([
    Y.mergeUpdates(updates.slice(2)),
    Y.mergeUpdates(updates.slice(1, 3)),
    updates[0]
  ])
  const separated = Y.mergeUpdates([
    Y.mergeUpdates([updates[0], updates[2]]),
    Y.mergeUpdates([updates[1], updates[3]])
  ])

  const targetState = Y.encodeStateAsUpdate(ydoc)
  ;[wrongOrder, overlapping, separated].forEach((updates, i) => {
    const merged = new Y.Doc()
    Y.applyUpdate(merged, updates)
    t.compareArrays(merged.getArray().toArray(), array.toArray())
    t.compare(updates, targetState)
  })
}

/**
 * @todo be able to apply Skip structs to Yjs docs
 */
