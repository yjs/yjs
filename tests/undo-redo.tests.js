import { init, compare, applyRandomTests, Doc } from './testHelper.js' // eslint-disable-line

import {
  UndoManager
} from '../src/internals.js'

import * as Y from '../src/index.js'
import * as t from 'lib0/testing.js'

/**
 * @param {t.TestCase} tc
 */
export const testUndoText = tc => {
  const { testConnector, text0, text1 } = init(tc, { users: 3 })
  const undoManager = new UndoManager(text0)
  text0.insert(0, 'abc')
  text1.insert(0, 'xyz')
  testConnector.syncAll()
  undoManager.undo()
  t.assert(text0.toString() === 'xyz')
  undoManager.redo()
  t.assert(text0.toString() === 'abcxyz')
  testConnector.syncAll()
  text1.delete(0, 1)
  testConnector.syncAll()
  undoManager.undo()
  t.assert(text0.toString() === 'xyz')
  undoManager.redo()
  t.assert(text0.toString() === 'bcxyz')
  // test marks
  text0.format(1, 3, { bold: true })
  t.compare(text0.toDelta(), [{ insert: 'b' }, { insert: 'cxy', attributes: { bold: true } }, { insert: 'z' }])
  undoManager.undo()
  t.compare(text0.toDelta(), [{ insert: 'bcxyz' }])
  undoManager.redo()
  t.compare(text0.toDelta(), [{ insert: 'b' }, { insert: 'cxy', attributes: { bold: true } }, { insert: 'z' }])
}

/**
 * @param {t.TestCase} tc
 */
export const testUndoMap = tc => {
  const { testConnector, map0, map1 } = init(tc, { users: 2 })
  map0.set('a', 0)
  const undoManager = new UndoManager(map0)
  map0.set('a', 1)
  undoManager.undo()
  t.assert(map0.get('a') === 0)
  undoManager.redo()
  t.assert(map0.get('a') === 1)
  // testing sub-types and if it can restore a whole type
  const subType = new Y.Map()
  map0.set('a', subType)
  subType.set('x', 42)
  t.compare(map0.toJSON(), /** @type {any} */ ({ 'a': { x: 42 } }))
  undoManager.undo()
  t.assert(map0.get('a') === 1)
  undoManager.redo()
  t.compare(map0.toJSON(), /** @type {any} */ ({ 'a': { x: 42 } }))
  testConnector.syncAll()
  // if content is overwritten by another user, undo operations should be skipped
  map1.set('a', 44)
  testConnector.syncAll()
  undoManager.undo()
  t.assert(map0.get('a') === 44)
  undoManager.redo()
  t.assert(map0.get('a') === 44)
}

/**
 * @param {t.TestCase} tc
 */
export const testUndoArray = tc => {
  const { testConnector, array0, array1 } = init(tc, { users: 3 })
  const undoManager = new UndoManager(array0)
  array0.insert(0, [1, 2, 3])
  array1.insert(0, [4, 5, 6])
  testConnector.syncAll()
  t.compare(array0.toArray(), [1, 2, 3, 4, 5, 6])
  undoManager.undo()
  t.compare(array0.toArray(), [4, 5, 6])
  undoManager.redo()
  t.compare(array0.toArray(), [1, 2, 3, 4, 5, 6])
  testConnector.syncAll()
  array1.delete(0, 1) // user1 deletes [1]
  testConnector.syncAll()
  undoManager.undo()
  t.compare(array0.toArray(), [4, 5, 6])
  undoManager.redo()
  t.compare(array0.toArray(), [2, 3, 4, 5, 6])
  array0.delete(0, 5)
  // test nested structure
  const ymap = new Y.Map()
  array0.insert(0, [ymap])
  t.compare(array0.toJSON(), [{}])
  undoManager.stopCapturing()
  ymap.set('a', 1)
  t.compare(array0.toJSON(), [{ a: 1 }])
  undoManager.undo()
  t.compare(array0.toJSON(), [{}])
  undoManager.undo()
  t.compare(array0.toJSON(), [2, 3, 4, 5, 6])
  undoManager.redo()
  t.compare(array0.toJSON(), [{}])
  undoManager.redo()
  t.compare(array0.toJSON(), [{ a: 1 }])
  testConnector.syncAll()
  array1.get(0).set('b', 2)
  testConnector.syncAll()
  t.compare(array0.toJSON(), [{ a: 1, b: 2 }])
  undoManager.undo()
  t.compare(array0.toJSON(), [{ b: 2 }])
  undoManager.undo()
  t.compare(array0.toJSON(), [2, 3, 4, 5, 6])
  undoManager.redo()
  t.compare(array0.toJSON(), [{ b: 2 }])
  undoManager.redo()
  t.compare(array0.toJSON(), [{ a: 1, b: 2 }])
}

/**
 * @param {t.TestCase} tc
 */
export const testUndoXml = tc => {
  const { xml0 } = init(tc, { users: 3 })
  const undoManager = new UndoManager(xml0)
  const child = new Y.XmlElement('p')
  xml0.insert(0, [child])
  const textchild = new Y.XmlText('content')
  child.insert(0, [textchild])
  t.assert(xml0.toString() === '<undefined><p>content</p></undefined>')
  // format textchild and revert that change
  undoManager.stopCapturing()
  textchild.format(3, 4, { bold: {} })
  t.assert(xml0.toString() === '<undefined><p>con<bold>tent</bold></p></undefined>')
  undoManager.undo()
  t.assert(xml0.toString() === '<undefined><p>content</p></undefined>')
  undoManager.redo()
  t.assert(xml0.toString() === '<undefined><p>con<bold>tent</bold></p></undefined>')
  xml0.delete(0, 1)
  t.assert(xml0.toString() === '<undefined></undefined>')
  undoManager.undo()
  t.assert(xml0.toString() === '<undefined><p>con<bold>tent</bold></p></undefined>')
}

/**
 * @param {t.TestCase} tc
 */
export const testUndoEvents = tc => {
  const { text0 } = init(tc, { users: 3 })
  const undoManager = new UndoManager(text0)
  let counter = 0
  let receivedMetadata = -1
  undoManager.on('stack-item-added', /** @param {any} event */ event => {
    t.assert(event.type != null)
    event.stackItem.meta.set('test', counter++)
  })
  undoManager.on('stack-item-popped', /** @param {any} event */ event => {
    t.assert(event.type != null)
    receivedMetadata = event.stackItem.meta.get('test')
  })
  text0.insert(0, 'abc')
  undoManager.undo()
  t.assert(receivedMetadata === 0)
  undoManager.redo()
  t.assert(receivedMetadata === 1)
}

/**
 * @param {t.TestCase} tc
 */
export const testTrackClass = tc => {
  const { users, text0 } = init(tc, { users: 3 })
  // only track origins that are numbers
  const undoManager = new UndoManager(text0, new Set([Number]))
  users[0].transact(() => {
    text0.insert(0, 'abc')
  }, 42)
  t.assert(text0.toString() === 'abc')
  undoManager.undo()
  t.assert(text0.toString() === '')
}
