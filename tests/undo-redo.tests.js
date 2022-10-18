import { init, compare, applyRandomTests, Doc } from './testHelper.js' // eslint-disable-line

import * as Y from '../src/index.js'
import * as t from 'lib0/testing'

/**
 * @param {t.TestCase} tc
 */
export const testInfiniteCaptureTimeout = tc => {
  const { array0 } = init(tc, { users: 3 })
  const undoManager = new Y.UndoManager(array0, { captureTimeout: Number.MAX_VALUE })
  array0.push([1, 2, 3])
  undoManager.stopCapturing()
  array0.push([4, 5, 6])
  undoManager.undo()
  t.compare(array0.toArray(), [1, 2, 3])
}

/**
 * @param {t.TestCase} tc
 */
export const testUndoText = tc => {
  const { testConnector, text0, text1 } = init(tc, { users: 3 })
  const undoManager = new Y.UndoManager(text0)

  // items that are added & deleted in the same transaction won't be undo
  text0.insert(0, 'test')
  text0.delete(0, 4)
  undoManager.undo()
  t.assert(text0.toString() === '')

  // follow redone items
  text0.insert(0, 'a')
  undoManager.stopCapturing()
  text0.delete(0, 1)
  undoManager.stopCapturing()
  undoManager.undo()
  t.assert(text0.toString() === 'a')
  undoManager.undo()
  t.assert(text0.toString() === '')

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
 * Test case to fix #241
 * @param {t.TestCase} tc
 */
export const testEmptyTypeScope = tc => {
  const ydoc = new Y.Doc()
  const um = new Y.UndoManager([], { doc: ydoc })
  const yarray = ydoc.getArray()
  um.addToScope(yarray)
  yarray.insert(0, [1])
  um.undo()
  t.assert(yarray.length === 0)
}

/**
 * Test case to fix #241
 * @param {t.TestCase} tc
 */
export const testDoubleUndo = tc => {
  const doc = new Y.Doc()
  const text = doc.getText()
  text.insert(0, '1221')

  const manager = new Y.UndoManager(text)

  text.insert(2, '3')
  text.insert(3, '3')

  manager.undo()
  manager.undo()

  text.insert(2, '3')

  t.compareStrings(text.toString(), '12321')
}

/**
 * @param {t.TestCase} tc
 */
export const testUndoMap = tc => {
  const { testConnector, map0, map1 } = init(tc, { users: 2 })
  map0.set('a', 0)
  const undoManager = new Y.UndoManager(map0)
  map0.set('a', 1)
  undoManager.undo()
  t.assert(map0.get('a') === 0)
  undoManager.redo()
  t.assert(map0.get('a') === 1)
  // testing sub-types and if it can restore a whole type
  const subType = new Y.Map()
  map0.set('a', subType)
  subType.set('x', 42)
  t.compare(map0.toJSON(), /** @type {any} */ ({ a: { x: 42 } }))
  undoManager.undo()
  t.assert(map0.get('a') === 1)
  undoManager.redo()
  t.compare(map0.toJSON(), /** @type {any} */ ({ a: { x: 42 } }))
  testConnector.syncAll()
  // if content is overwritten by another user, undo operations should be skipped
  map1.set('a', 44)
  testConnector.syncAll()
  undoManager.undo()
  t.assert(map0.get('a') === 44)
  undoManager.redo()
  t.assert(map0.get('a') === 44)

  // test setting value multiple times
  map0.set('b', 'initial')
  undoManager.stopCapturing()
  map0.set('b', 'val1')
  map0.set('b', 'val2')
  undoManager.stopCapturing()
  undoManager.undo()
  t.assert(map0.get('b') === 'initial')
}

/**
 * @param {t.TestCase} tc
 */
export const testUndoArray = tc => {
  const { testConnector, array0, array1 } = init(tc, { users: 3 })
  const undoManager = new Y.UndoManager(array0)
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
  const undoManager = new Y.UndoManager(xml0)
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
  const undoManager = new Y.UndoManager(text0)
  let counter = 0
  let receivedMetadata = -1
  undoManager.on('stack-item-added', /** @param {any} event */ event => {
    t.assert(event.type != null)
    t.assert(event.changedParentTypes != null && event.changedParentTypes.has(text0))
    event.stackItem.meta.set('test', counter++)
  })
  undoManager.on('stack-item-popped', /** @param {any} event */ event => {
    t.assert(event.type != null)
    t.assert(event.changedParentTypes != null && event.changedParentTypes.has(text0))
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
  const undoManager = new Y.UndoManager(text0, { trackedOrigins: new Set([Number]) })
  users[0].transact(() => {
    text0.insert(0, 'abc')
  }, 42)
  t.assert(text0.toString() === 'abc')
  undoManager.undo()
  t.assert(text0.toString() === '')
}

/**
 * @param {t.TestCase} tc
 */
export const testTypeScope = tc => {
  const { array0 } = init(tc, { users: 3 })
  // only track origins that are numbers
  const text0 = new Y.Text()
  const text1 = new Y.Text()
  array0.insert(0, [text0, text1])
  const undoManager = new Y.UndoManager(text0)
  const undoManagerBoth = new Y.UndoManager([text0, text1])
  text1.insert(0, 'abc')
  t.assert(undoManager.undoStack.length === 0)
  t.assert(undoManagerBoth.undoStack.length === 1)
  t.assert(text1.toString() === 'abc')
  undoManager.undo()
  t.assert(text1.toString() === 'abc')
  undoManagerBoth.undo()
  t.assert(text1.toString() === '')
}

/**
 * @param {t.TestCase} tc
 */
export const testUndoInEmbed = tc => {
  const { text0 } = init(tc, { users: 3 })
  const undoManager = new Y.UndoManager(text0)
  const nestedText = new Y.Text('initial text')
  undoManager.stopCapturing()
  text0.insertEmbed(0, nestedText, { bold: true })
  t.assert(nestedText.toString() === 'initial text')
  undoManager.stopCapturing()
  nestedText.delete(0, nestedText.length)
  nestedText.insert(0, 'other text')
  t.assert(nestedText.toString() === 'other text')
  undoManager.undo()
  t.assert(nestedText.toString() === 'initial text')
  undoManager.undo()
  t.assert(text0.length === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testUndoDeleteFilter = tc => {
  /**
   * @type {Y.Array<any>}
   */
  const array0 = /** @type {any} */ (init(tc, { users: 3 }).array0)
  const undoManager = new Y.UndoManager(array0, { deleteFilter: item => !(item instanceof Y.Item) || (item.content instanceof Y.ContentType && item.content.type._map.size === 0) })
  const map0 = new Y.Map()
  map0.set('hi', 1)
  const map1 = new Y.Map()
  array0.insert(0, [map0, map1])
  undoManager.undo()
  t.assert(array0.length === 1)
  array0.get(0)
  t.assert(Array.from(array0.get(0).keys()).length === 1)
}

/**
 * This issue has been reported in https://discuss.yjs.dev/t/undomanager-with-external-updates/454/6
 * @param {t.TestCase} tc
 */
export const testUndoUntilChangePerformed = tc => {
  const doc = new Y.Doc()
  const doc2 = new Y.Doc()
  doc.on('update', update => Y.applyUpdate(doc2, update))
  doc2.on('update', update => Y.applyUpdate(doc, update))

  const yArray = doc.getArray('array')
  const yArray2 = doc2.getArray('array')
  const yMap = new Y.Map()
  yMap.set('hello', 'world')
  yArray.push([yMap])
  const yMap2 = new Y.Map()
  yMap2.set('key', 'value')
  yArray.push([yMap2])

  const undoManager = new Y.UndoManager([yArray], { trackedOrigins: new Set([doc.clientID]) })
  const undoManager2 = new Y.UndoManager([doc2.get('array')], { trackedOrigins: new Set([doc2.clientID]) })

  Y.transact(doc, () => yMap2.set('key', 'value modified'), doc.clientID)
  undoManager.stopCapturing()
  Y.transact(doc, () => yMap.set('hello', 'world modified'), doc.clientID)
  Y.transact(doc2, () => yArray2.delete(0), doc2.clientID)
  undoManager2.undo()
  undoManager.undo()
  t.compareStrings(yMap2.get('key'), 'value')
}

/**
 * This issue has been reported in https://github.com/yjs/yjs/issues/317
 * @param {t.TestCase} tc
 */
export const testUndoNestedUndoIssue = tc => {
  const doc = new Y.Doc({ gc: false })
  const design = doc.getMap()
  const undoManager = new Y.UndoManager(design, { captureTimeout: 0 })

  /**
   * @type {Y.Map<any>}
   */
  const text = new Y.Map()

  const blocks1 = new Y.Array()
  const blocks1block = new Y.Map()

  doc.transact(() => {
    blocks1block.set('text', 'Type Something')
    blocks1.push([blocks1block])
    text.set('blocks', blocks1block)
    design.set('text', text)
  })

  const blocks2 = new Y.Array()
  const blocks2block = new Y.Map()
  doc.transact(() => {
    blocks2block.set('text', 'Something')
    blocks2.push([blocks2block])
    text.set('blocks', blocks2block)
  })

  const blocks3 = new Y.Array()
  const blocks3block = new Y.Map()
  doc.transact(() => {
    blocks3block.set('text', 'Something Else')
    blocks3.push([blocks3block])
    text.set('blocks', blocks3block)
  })

  t.compare(design.toJSON(), { text: { blocks: { text: 'Something Else' } } })
  undoManager.undo()
  t.compare(design.toJSON(), { text: { blocks: { text: 'Something' } } })
  undoManager.undo()
  t.compare(design.toJSON(), { text: { blocks: { text: 'Type Something' } } })
  undoManager.undo()
  t.compare(design.toJSON(), { })
  undoManager.redo()
  t.compare(design.toJSON(), { text: { blocks: { text: 'Type Something' } } })
  undoManager.redo()
  t.compare(design.toJSON(), { text: { blocks: { text: 'Something' } } })
  undoManager.redo()
  t.compare(design.toJSON(), { text: { blocks: { text: 'Something Else' } } })
}

/**
 * This issue has been reported in https://github.com/yjs/yjs/issues/355
 *
 * @param {t.TestCase} tc
 */
export const testConsecutiveRedoBug = tc => {
  const doc = new Y.Doc()
  const yRoot = doc.getMap()
  const undoMgr = new Y.UndoManager(yRoot)

  let yPoint = new Y.Map()
  yPoint.set('x', 0)
  yPoint.set('y', 0)
  yRoot.set('a', yPoint)
  undoMgr.stopCapturing()

  yPoint.set('x', 100)
  yPoint.set('y', 100)
  undoMgr.stopCapturing()

  yPoint.set('x', 200)
  yPoint.set('y', 200)
  undoMgr.stopCapturing()

  yPoint.set('x', 300)
  yPoint.set('y', 300)
  undoMgr.stopCapturing()

  t.compare(yPoint.toJSON(), { x: 300, y: 300 })

  undoMgr.undo() // x=200, y=200
  t.compare(yPoint.toJSON(), { x: 200, y: 200 })
  undoMgr.undo() // x=100, y=100
  t.compare(yPoint.toJSON(), { x: 100, y: 100 })
  undoMgr.undo() // x=0, y=0
  t.compare(yPoint.toJSON(), { x: 0, y: 0 })
  undoMgr.undo() // nil
  t.compare(yRoot.get('a'), undefined)

  undoMgr.redo() // x=0, y=0
  yPoint = yRoot.get('a')

  t.compare(yPoint.toJSON(), { x: 0, y: 0 })
  undoMgr.redo() // x=100, y=100
  t.compare(yPoint.toJSON(), { x: 100, y: 100 })
  undoMgr.redo() // x=200, y=200
  t.compare(yPoint.toJSON(), { x: 200, y: 200 })
  undoMgr.redo() // expected x=300, y=300, actually nil
  t.compare(yPoint.toJSON(), { x: 300, y: 300 })
}

/**
 * This issue has been reported in https://github.com/yjs/yjs/issues/304
 *
 * @param {t.TestCase} tc
 */
export const testUndoXmlBug = tc => {
  const origin = 'origin'
  const doc = new Y.Doc()
  const fragment = doc.getXmlFragment('t')
  const undoManager = new Y.UndoManager(fragment, {
    captureTimeout: 0,
    trackedOrigins: new Set([origin])
  })

  // create element
  doc.transact(() => {
    const e = new Y.XmlElement('test-node')
    e.setAttribute('a', '100')
    e.setAttribute('b', '0')
    fragment.insert(fragment.length, [e])
  }, origin)

  // change one attribute
  doc.transact(() => {
    const e = fragment.get(0)
    e.setAttribute('a', '200')
  }, origin)

  // change both attributes
  doc.transact(() => {
    const e = fragment.get(0)
    e.setAttribute('a', '180')
    e.setAttribute('b', '50')
  }, origin)

  undoManager.undo()
  undoManager.undo()
  undoManager.undo()

  undoManager.redo()
  undoManager.redo()
  undoManager.redo()
  t.compare(fragment.toString(), '<test-node a="180" b="50"></test-node>')
}

/**
 * This issue has been reported in https://github.com/yjs/yjs/issues/343
 *
 * @param {t.TestCase} tc
 */
export const testUndoBlockBug = tc => {
  const doc = new Y.Doc({ gc: false })
  const design = doc.getMap()

  const undoManager = new Y.UndoManager(design, { captureTimeout: 0 })

  const text = new Y.Map()

  const blocks1 = new Y.Array()
  const blocks1block = new Y.Map()
  doc.transact(() => {
    blocks1block.set('text', '1')
    blocks1.push([blocks1block])

    text.set('blocks', blocks1block)
    design.set('text', text)
  })

  const blocks2 = new Y.Array()
  const blocks2block = new Y.Map()
  doc.transact(() => {
    blocks2block.set('text', '2')
    blocks2.push([blocks2block])
    text.set('blocks', blocks2block)
  })

  const blocks3 = new Y.Array()
  const blocks3block = new Y.Map()
  doc.transact(() => {
    blocks3block.set('text', '3')
    blocks3.push([blocks3block])
    text.set('blocks', blocks3block)
  })

  const blocks4 = new Y.Array()
  const blocks4block = new Y.Map()
  doc.transact(() => {
    blocks4block.set('text', '4')
    blocks4.push([blocks4block])
    text.set('blocks', blocks4block)
  })

  // {"text":{"blocks":{"text":"4"}}}
  undoManager.undo() // {"text":{"blocks":{"3"}}}
  undoManager.undo() // {"text":{"blocks":{"text":"2"}}}
  undoManager.undo() // {"text":{"blocks":{"text":"1"}}}
  undoManager.undo() // {}
  undoManager.redo() // {"text":{"blocks":{"text":"1"}}}
  undoManager.redo() // {"text":{"blocks":{"text":"2"}}}
  undoManager.redo() // {"text":{"blocks":{"text":"3"}}}
  undoManager.redo() // {"text":{}}
  t.compare(design.toJSON(), { text: { blocks: { text: '4' } } })
}

/**
 * Undo text formatting delete should not corrupt peer state.
 *
 * @see https://github.com/yjs/yjs/issues/392
 * @param {t.TestCase} tc
 */
export const testUndoDeleteTextFormat = tc => {
  const doc = new Y.Doc()
  const text = doc.getText()
  text.insert(0, 'Attack ships on fire off the shoulder of Orion.')
  const doc2 = new Y.Doc()
  const text2 = doc2.getText()
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc))
  const undoManager = new Y.UndoManager(text)

  text.format(13, 7, { bold: true })
  undoManager.stopCapturing()
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc))

  text.format(16, 4, { bold: null })
  undoManager.stopCapturing()
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc))

  undoManager.undo()
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc))

  const expect = [
    { insert: 'Attack ships ' },
    {
      insert: 'on fire',
      attributes: { bold: true }
    },
    { insert: ' off the shoulder of Orion.' }
  ]
  t.compare(text.toDelta(), expect)
  t.compare(text2.toDelta(), expect)
}

/**
 * Undo text formatting delete should not corrupt peer state.
 *
 * @see https://github.com/yjs/yjs/issues/392
 * @param {t.TestCase} tc
 */
export const testBehaviorOfIgnoreremotemapchangesProperty = tc => {
  const doc = new Y.Doc()
  const doc2 = new Y.Doc()
  doc.on('update', update => Y.applyUpdate(doc2, update, doc))
  doc2.on('update', update => Y.applyUpdate(doc, update, doc2))
  const map1 = doc.getMap()
  const map2 = doc2.getMap()
  const um1 = new Y.UndoManager(map1, { ignoreRemoteMapChanges: true })
  map1.set('x', 1)
  map2.set('x', 2)
  map1.set('x', 3)
  map2.set('x', 4)
  um1.undo()
  t.assert(map1.get('x') === 2)
  t.assert(map2.get('x') === 2)
}

/**
 * Special deletion case.
 *
 * @see https://github.com/yjs/yjs/issues/447
 * @param {t.TestCase} tc
 */
export const testSpecialDeletionCase = tc => {
  const origin = 'undoable'
  const doc = new Y.Doc()
  const fragment = doc.getXmlFragment()
  const undoManager = new Y.UndoManager(fragment, { trackedOrigins: new Set([origin]) })
  doc.transact(() => {
    const e = new Y.XmlElement('test')
    e.setAttribute('a', '1')
    e.setAttribute('b', '2')
    fragment.insert(0, [e])
  })
  t.compareStrings(fragment.toString(), '<test a="1" b="2"></test>')
  doc.transact(() => {
    // change attribute "b" and delete test-node
    const e = fragment.get(0)
    e.setAttribute('b', '3')
    fragment.delete(0)
  }, origin)
  t.compareStrings(fragment.toString(), '')
  undoManager.undo()
  t.compareStrings(fragment.toString(), '<test a="1" b="2"></test>')
}
