import * as Y from '../src/index.js'
import * as t from 'lib0/testing'

/**
 * This issue has been reported in https://github.com/yjs/yjs/issues/...
 * Undo-manager over arrays sometimes generates a wrong result when undoing.
 *
 * @param {t.TestCase} _tc
 */
export const testUndoArrayBug = _tc => {
  const doc = new Y.Doc()
  const array = doc.getArray('array')
  const undoManager = new Y.UndoManager(array, { captureTimeout: 0 })

  doc.transact(() => {
    array.insert(0, [1, 2, 3])
  })
  // 1,2,3
  t.compare(array.toJSON(), [1, 2, 3])

  doc.transact(() => {
    array.insert(2, [6, 7])
  })
  // 1,2,6,7,3
  t.compare(array.toJSON(), [1, 2, 6, 7, 3])

  doc.transact(() => {
    array.delete(1, 1)
    array.insert(1, [8])
  })
  // 1,8,6,7,3
  t.compare(array.toJSON(), [1, 8, 6, 7, 3])

  doc.transact(() => {
    array.delete(0, 1)
  })
  // 8,6,7,3
  t.compare(array.toJSON(), [8, 6, 7, 3])

  doc.transact(() => {
    array.delete(1, 2)
  })
  // 8,3
  t.compare(array.toJSON(), [8, 3])

  undoManager.undo()
  // 8,6,7,3
  t.compare(array.toJSON(), [8, 6, 7, 3])

  doc.transact(() => {
    array.insert(2, [9])
  })
  // 8,6,9,7,3
  t.compare(array.toJSON(), [8, 6, 9, 7, 3])

  undoManager.undo()
  // 8,6,7,3
  t.compare(array.toJSON(), [8, 6, 7, 3])

  undoManager.undo()
  // 1,8,6,7,3
  t.compare(array.toJSON(), [1, 8, 6, 7, 3])

  undoManager.undo()
  // 1,2,6,7,3
  t.compare(array.toJSON(), [1, 2, 6, 7, 3])

  undoManager.undo()
  // 1,2,3
  t.compare(array.toJSON(), [1, 2, 3]) // !! Expected [1,2,3] but actually has [1,2,7,3]
}
