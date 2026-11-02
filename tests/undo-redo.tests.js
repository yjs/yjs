import { init } from './testHelper.js' // eslint-disable-line

import * as Y from '../src/index.js'
import * as t from 'lib0/testing'
import * as prng from 'lib0/prng'

export const testInconsistentFormat = () => {
  /**
   * @param {Y.Doc} ydoc
   */
  const testYjsMerge = ydoc => {
    const content = /** @type {Y.XmlText} */ (ydoc.get('text', Y.XmlText))
    content.format(0, 6, { bold: null })
    content.format(6, 4, { type: 'text' })
    t.compare(content.toDelta(), [
      {
        attributes: { type: 'text' },
        insert: 'Merge Test'
      },
      {
        attributes: { type: 'text', italic: true },
        insert: ' After'
      }
    ])
  }
  const initializeYDoc = () => {
    const yDoc = new Y.Doc({ gc: false })

    const content = /** @type {Y.XmlText} */ (yDoc.get('text', Y.XmlText))
    content.insert(0, ' After', { type: 'text', italic: true })
    content.insert(0, 'Test', { type: 'text' })
    content.insert(0, 'Merge ', { type: 'text', bold: true })
    return yDoc
  }
  {
    const yDoc = initializeYDoc()
    testYjsMerge(yDoc)
  }
  {
    const initialYDoc = initializeYDoc()
    const yDoc = new Y.Doc({ gc: false })
    Y.applyUpdate(yDoc, Y.encodeStateAsUpdate(initialYDoc))
    testYjsMerge(yDoc)
  }
}

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
 * @param {t.TestCase} _tc
 */
export const testEmptyTypeScope = _tc => {
  const ydoc = new Y.Doc()
  const um = new Y.UndoManager([], { doc: ydoc })
  const yarray = ydoc.getArray()
  um.addToScope(yarray)
  yarray.insert(0, [1])
  um.undo()
  t.assert(yarray.length === 0)
}

/**
 * @param {t.TestCase} _tc
 */
export const testRejectUpdateExample = _tc => {
  const tmpydoc1 = new Y.Doc()
  tmpydoc1.getArray('restricted').insert(0, [1])
  tmpydoc1.getArray('public').insert(0, [1])
  const update1 = Y.encodeStateAsUpdate(tmpydoc1)
  const tmpydoc2 = new Y.Doc()
  tmpydoc2.getArray('public').insert(0, [2])
  const update2 = Y.encodeStateAsUpdate(tmpydoc2)

  const ydoc = new Y.Doc()
  const restrictedType = ydoc.getArray('restricted')

  /**
   * Assume this function handles incoming updates via a communication channel like websockets.
   * Changes to the `ydoc.getMap('restricted')` type should be rejected.
   *
   * - set up undo manager on the restricted types
   * - cache pending* updates from the Ydoc to avoid certain attacks
   * - apply received update and check whether the restricted type (or any of its children) has been changed.
   * - catch errors that might try to circumvent the restrictions
   * - undo changes on restricted types
   * - reapply pending* updates
   *
   * @param {Uint8Array} update
   */
  const updateHandler = (update) => {
    // don't handle changes of the local undo manager, which is used to undo invalid changes
    const um = new Y.UndoManager(restrictedType, { trackedOrigins: new Set(['remote change']) })
    const beforePendingDs = ydoc.store.pendingDs
    const beforePendingStructs = ydoc.store.pendingStructs?.update
    try {
      Y.applyUpdate(ydoc, update, 'remote change')
    } finally {
      while (um.undoStack.length) {
        um.undo()
      }
      um.destroy()
      ydoc.store.pendingDs = beforePendingDs
      ydoc.store.pendingStructs = null
      if (beforePendingStructs) {
        Y.applyUpdateV2(ydoc, beforePendingStructs)
      }
    }
  }
  updateHandler(update1)
  updateHandler(update2)
  t.assert(restrictedType.length === 0)
  t.assert(ydoc.getArray('public').length === 2)
}

/**
 * Test case to fix #241
 * @param {t.TestCase} _tc
 */
export const testGlobalScope = _tc => {
  const ydoc = new Y.Doc()
  const um = new Y.UndoManager(ydoc)
  const yarray = ydoc.getArray()
  yarray.insert(0, [1])
  um.undo()
  t.assert(yarray.length === 0)
}

/**
 * Test case to fix #241
 * @param {t.TestCase} _tc
 */
export const testDoubleUndo = _tc => {
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
 * @param {t.TestCase} _tc
 */
export const testUndoUntilChangePerformed = _tc => {
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
 * @param {t.TestCase} _tc
 */
export const testUndoNestedUndoIssue = _tc => {
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
 * @param {t.TestCase} _tc
 */
export const testConsecutiveRedoBug = _tc => {
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
 * @param {t.TestCase} _tc
 */
export const testUndoXmlBug = _tc => {
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
 * @param {t.TestCase} _tc
 */
export const testUndoBlockBug = _tc => {
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
 * @param {t.TestCase} _tc
 */
export const testUndoDeleteTextFormat = _tc => {
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
 * @param {t.TestCase} _tc
 */
export const testBehaviorOfIgnoreremotemapchangesProperty = _tc => {
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
 * @param {t.TestCase} _tc
 */
export const testSpecialDeletionCase = _tc => {
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

/**
 * Deleted entries in a map should be restored on undo.
 *
 * @see https://github.com/yjs/yjs/issues/500
 * @param {t.TestCase} tc
 */
export const testUndoDeleteInMap = (tc) => {
  const { map0 } = init(tc, { users: 3 })
  const undoManager = new Y.UndoManager(map0, { captureTimeout: 0 })
  map0.set('a', 'a')
  map0.delete('a')
  map0.set('a', 'b')
  map0.delete('a')
  map0.set('a', 'c')
  map0.delete('a')
  map0.set('a', 'd')
  t.compare(map0.toJSON(), { a: 'd' })
  undoManager.undo()
  t.compare(map0.toJSON(), {})
  undoManager.undo()
  t.compare(map0.toJSON(), { a: 'c' })
  undoManager.undo()
  t.compare(map0.toJSON(), {})
  undoManager.undo()
  t.compare(map0.toJSON(), { a: 'b' })
  undoManager.undo()
  t.compare(map0.toJSON(), {})
  undoManager.undo()
  t.compare(map0.toJSON(), { a: 'a' })
}

/**
 * It should expose the StackItem being processed if undoing
 *
 * @param {t.TestCase} _tc
 */
export const testUndoDoingStackItem = async (_tc) => {
  const doc = new Y.Doc()
  const text = doc.getText('text')
  const undoManager = new Y.UndoManager([text])
  undoManager.on('stack-item-added', /** @param {any} event */ event => {
    event.stackItem.meta.set('str', '42')
  })
  let metaUndo = /** @type {any} */ (null)
  let metaRedo = /** @type {any} */ (null)
  text.observe((event) => {
    const /** @type {Y.UndoManager} */ origin = event.transaction.origin
    if (origin === undoManager && origin.undoing) {
      metaUndo = origin.currStackItem?.meta.get('str')
    } else if (origin === undoManager && origin.redoing) {
      metaRedo = origin.currStackItem?.meta.get('str')
    }
  })
  text.insert(0, 'abc')
  undoManager.undo()
  undoManager.redo()
  t.compare(metaUndo, '42', 'currStackItem is accessible while undoing')
  t.compare(metaRedo, '42', 'currStackItem is accessible while redoing')
  t.compare(undoManager.currStackItem, null, 'currStackItem is null after observe/transaction')
}

/**
 * @see https://github.com/yjs/yjs/issues/757
 * @param {t.TestCase} _tc
 */
export const testUndoSetAttributeAndDeleteSyncsAttributes = _tc => {
  const doc = new Y.Doc()
  const root = /** @type {Y.XmlText} */ (doc.get('sharedRoot', Y.XmlText))
  const button = new Y.XmlText()
  button.setAttribute('type', 'button')
  button.setAttribute('test', true)
  button.insert(0, 'Click me')
  root.insertEmbed(0, button)

  const undoManager = new Y.UndoManager(root)
  undoManager.stopCapturing()

  button.setAttribute('type', 'paragraph')
  root.delete(0, 1)
  undoManager.undo()

  const expectedAttrs = { type: 'button', test: true }
  const expectedText = 'Click me'
  t.compare(root.toDelta()[0].insert.getAttributes(), expectedAttrs)
  t.compare(root.toDelta()[0].insert.toString(), expectedText)

  const remoteDoc = new Y.Doc()
  Y.applyUpdateV2(remoteDoc, Y.encodeStateAsUpdateV2(doc))
  const remoteRoot = /** @type {Y.XmlText} */ (remoteDoc.get('sharedRoot', Y.XmlText))
  t.compare(remoteRoot.toDelta()[0].insert.getAttributes(), expectedAttrs)
  t.compare(remoteRoot.toDelta()[0].insert.toString(), expectedText)
}

/**
 * @param {Y.Doc} doc
 * @return {Array<Y.Item>}
 */
const getKeptItems = doc => {
  /**
   * @type {Array<Y.Item>}
   */
  const kept = []
  doc.store.clients.forEach(structs => {
    structs.forEach(struct => {
      if (struct instanceof Y.Item && struct.keep) kept.push(struct)
    })
  })
  return kept
}

/**
 * A table (map) with a row (array) holding a cell (xml element with a text and an attribute),
 * created before any UndoManager exists.
 *
 * @param {boolean} gc
 */
const createTableDoc = gc => {
  const doc = new Y.Doc({ gc })
  doc.clientID = 1
  const root = doc.getArray('root')
  const table = new Y.Map()
  const row = new Y.Array()
  const cell = new Y.XmlElement('cell')
  const text = new Y.XmlText('cell text')
  root.insert(0, [table])
  table.set('row', row)
  row.insert(0, [cell])
  cell.insert(0, [text])
  cell.setAttribute('a', '1')
  return { doc, root, table, row, cell, text }
}

/**
 * Another client deletes all children of the root and the change is applied to doc.
 *
 * @param {Y.Doc} doc
 */
const deleteRootChildrenRemotely = doc => {
  const remote = new Y.Doc({ gc: doc.gc })
  remote.clientID = 2
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc))
  const remoteRoot = remote.getArray('root')
  remoteRoot.delete(0, remoteRoot.length)
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(doc)), 'remote')
}

/**
 * @param {Y.Doc} doc
 */
const encodedSizeAfterReload = doc => {
  const reloaded = new Y.Doc({ gc: doc.gc })
  Y.applyUpdate(reloaded, Y.encodeStateAsUpdate(doc))
  return Y.encodeStateAsUpdate(reloaded).length
}

/**
 * @type {Array<[string, function(ReturnType<typeof createTableDoc> & { um: Y.UndoManager }):void, any]>}
 */
const nestedUndoRedoFlows = [
  ['insert text, undo, redo', ({ text, um }) => { text.insert(4, ' typed'); um.undo(); um.redo() }, { cell: '<cell a="1">cell typed text</cell>' }],
  ['delete text, undo', ({ text, um }) => { text.delete(1, 2); um.undo() }, {}],
  ['delete text, undo, redo, undo', ({ text, um }) => { text.delete(1, 2); um.undo(); um.redo(); um.undo() }, {}],
  ['format text, undo, redo', ({ text, um }) => { text.format(0, 4, { bold: true }); um.undo(); um.redo() }, { cell: '<cell a="1"><bold>cell</bold> text</cell>' }],
  ['set attribute, undo, redo', ({ cell, um }) => { cell.setAttribute('a', '2'); um.undo(); um.redo() }, { cell: '<cell a="2">cell text</cell>' }],
  ['set map key, delete map key, undo', ({ table, um }) => { table.set('k', 1); table.delete('k'); um.undo() }, { table: { k: 1 } }],
  ['insert array content, undo, redo', ({ row, um }) => { row.insert(1, [1, 2]); um.undo(); um.redo() }, { row: 3 }],
  ['delete xml child, undo', ({ cell, um }) => { cell.delete(0, 1); um.undo() }, {}]
]

/**
 * After an undo or redo restored content inside a nested type, and the stacks are cleared, the
 * UndoManager must not keep any item. Otherwise a nested type that a collaborator deletes later is
 * never garbage-collected.
 *
 * @param {t.TestCase} _tc
 */
export const testUndoRedoInNestedTypeReleasesKeptItems = _tc => {
  for (const gc of [true, false]) {
    for (const [name, flow, expected] of nestedUndoRedoFlows) {
      const ctx = createTableDoc(gc)
      const { doc, root, table, row, cell } = ctx
      const um = new Y.UndoManager(root, { captureTimeout: 0 })
      flow({ ...ctx, um })
      t.compareStrings(cell.toString(), expected.cell || '<cell a="1">cell text</cell>', name)
      t.assert(row.length === (expected.row || 1), name)
      t.compare(table.get('k'), expected.table ? expected.table.k : undefined, name)
      um.clear()
      t.compare(getKeptItems(doc).map(item => item.id), [], `${name}: nothing is kept after clear (gc: ${gc})`)
      um.destroy()
      deleteRootChildrenRemotely(doc)
      if (gc) {
        t.assert(/** @type {Y.Item} */ (table._item).content instanceof Y.ContentDeleted, `${name}: the deleted table is garbage-collected`)
        t.assert(Y.encodeStateAsUpdate(doc).length === encodedSizeAfterReload(doc), `${name}: the document is as small as after a reload`)
      }
    }
  }
}

/**
 * A new change clears the redo stack. That releases what the undone stack item kept, and the content
 * that its undo restored.
 *
 * @param {t.TestCase} _tc
 */
export const testNewChangeAfterUndoReleasesKeptItems = _tc => {
  const { doc, root, table, text } = createTableDoc(true)
  const paragraph = new Y.XmlText()
  root.insert(1, [paragraph])
  const um = new Y.UndoManager(root, { captureTimeout: 0 })
  text.delete(1, 2)
  t.assert(um.undo() !== null)
  t.compareStrings(text.toString(), 'cell text')
  t.assert(getKeptItems(doc).length > 0)
  paragraph.insert(0, 'new') // clears the redo stack
  t.assert(um.canUndo() && !um.canRedo())
  t.compare(getKeptItems(doc).map(item => item.id), [])
  deleteRootChildrenRemotely(doc)
  t.assert(/** @type {Y.Item} */ (table._item).content instanceof Y.ContentDeleted)
  t.assert(um.undo() === null) // the paragraph was deleted by the collaborator
}

/**
 * @param {Y.Item} item
 */
const isKeptWithParents = item => {
  for (let it = /** @type {Y.Item|null} */ (item); it !== null; it = /** @type {Y.AbstractType<any>} */ (it.parent)._item) {
    if (!it.keep) return false
  }
  return true
}

/**
 * @param {Y.Doc} doc
 * @param {string} str
 */
const findDeletedString = (doc, str) => getKeptItems(doc).find(item => item.deleted && item.content instanceof Y.ContentString && item.content.str === str)

/**
 * Clearing one stack must keep what the stack items on the other stack need, parents included.
 *
 * @param {t.TestCase} _tc
 */
export const testUndoKeepsItemsOfRemainingStackItems = _tc => {
  for (const [clearUndo, clearRedo] of [[false, false], [true, false], [false, true]]) {
    const { doc, root, text } = createTableDoc(true)
    const um = new Y.UndoManager(root, { captureTimeout: 0 })
    text.delete(0, 1) // 'ell text'
    text.delete(4, 4) // 'ell '
    text.insert(0, 'x') // 'xell '
    um.undo() // 'ell ' (the redo stack item keeps the deleted 'x')
    um.undo() // 'ell text'
    t.compareStrings(text.toString(), 'ell text')
    t.assert(um.canUndo() && um.canRedo())
    um.clear(clearUndo, clearRedo)
    t.assert(um.canUndo() === !clearUndo && um.canRedo() === !clearRedo)
    if (!clearUndo) {
      // the first deletion is still on the undo stack: it is kept, parents included
      const c = findDeletedString(doc, 'c')
      t.assert(c !== undefined && isKeptWithParents(c))
    }
    if (!clearRedo) {
      const x = findDeletedString(doc, 'x')
      t.assert(x !== undefined && isKeptWithParents(x))
    }
    if (!clearUndo) {
      t.assert(um.undo() !== null)
      t.compareStrings(text.toString(), 'cell text')
    }
    if (!clearRedo) {
      while (um.canRedo()) t.assert(um.redo() !== null)
      t.compareStrings(text.toString(), 'xell ')
    }
    um.clear()
    t.compare(getKeptItems(doc).map(item => item.id), [])
  }
}

/**
 * clear() must not release what another UndoManager on the same document keeps, also where that
 * UndoManager deleted an item that this UndoManager's undo or redo created, or a type around it.
 *
 * @param {t.TestCase} _tc
 */
export const testClearKeepsWhatAnotherUndoManagerDeleted = _tc => {
  /**
   * @type {Array<[string, function(ReturnType<typeof createTableDoc>, Y.UndoManager):void, string]>}
   */
  const cases = [
    ['the re-created text', ({ doc, text }, um1) => {
      doc.transact(() => text.insert(9, '!'), 'a')
      um1.undo()
      um1.redo() // re-creates '!'
      doc.transact(() => text.delete(9, 1), 'b')
    }, '<cell a="1">cell text!</cell>'],
    ['the cell around re-created text', ({ doc, row, text }, um1) => {
      doc.transact(() => text.insert(9, '!'), 'a')
      um1.undo()
      um1.redo() // re-creates '!'
      doc.transact(() => row.delete(0, 1), 'b')
    }, '<cell a="1">cell text!</cell>'],
    ['a re-created cell', ({ doc, row }, um1) => {
      doc.transact(() => row.delete(0, 1), 'a')
      um1.undo() // re-creates the cell and its text
      doc.transact(() => row.delete(0, 1), 'b')
    }, '<cell a="1">cell text</cell>']
  ]
  for (const [name, edit, expected] of cases) {
    const ctx = createTableDoc(true)
    const { doc, root, row } = ctx
    const um1 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['a']) })
    const um2 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['b']) })
    edit(ctx, um1)
    um1.clear()
    // collect everything that nothing keeps
    Y.tryGc(Y.createDeleteSetFromStructStore(doc.store), doc.store, () => true)
    t.assert(um2.undo() !== null, name)
    t.compareStrings(row.get(0).toString(), expected, name)
  }
}

/**
 * An undo of an insertion follows the inserted item through `redone` to the item that replaced it.
 * clear() must not release what another UndoManager's undo still follows.
 *
 * @param {t.TestCase} _tc
 */
export const testClearKeepsWhatAnotherUndoManagerFollows = _tc => {
  const { doc, root, row, cell } = createTableDoc(true)
  const um1 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['a']) })
  const um2 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['b']) })
  doc.transact(() => cell.insert(0, [new Y.XmlElement('n')]), 'a')
  doc.transact(() => row.delete(0, 1), 'b') // deletes the cell with the inserted element
  um2.undo() // re-creates the cell and the element
  um2.clear()
  // collect everything that nothing keeps
  Y.tryGc(Y.createDeleteSetFromStructStore(doc.store), doc.store, () => true)
  t.assert(um1.undo() !== null) // follows the element to the re-created one and deletes it
  t.compareStrings(row.get(0).toString(), '<cell a="1">cell text</cell>')
}

/**
 * The item an undo or redo re-created can be split and re-created again. Every deleted part that
 * another UndoManager's undo follows stays kept until that UndoManager is cleared.
 *
 * @param {t.TestCase} _tc
 */
export const testClearKeepsSplitRedoneItems = _tc => {
  const { doc, root, row, text } = createTableDoc(true)
  const um1 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['a']) })
  const um2 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['b']) })
  const um3 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['c']) })
  doc.transact(() => text.insert(0, 'ABCD'), 'a')
  doc.transact(() => row.delete(0, 1), 'b')
  um2.undo() // re-creates the cell, its text and 'ABCD'
  doc.transact(() => row.get(0).get(0).delete(1, 2), 'c') // splits the re-created 'ABCD'
  um3.undo() // re-creates 'BC'
  t.compareStrings(row.get(0).toString(), '<cell a="1">ABCDcell text</cell>')
  um2.clear()
  um3.clear()
  // what um1's undo follows from 'ABCD' and that is deleted stays kept: 'ABCD' and the re-created
  // 'BC' that um3's step deleted. The live re-created 'A', 'D' and 'BC' can't be collected.
  t.compare(getKeptItems(doc).filter(item => item.deleted && item.content instanceof Y.ContentString).map(item => /** @type {Y.ContentString} */ (item.content).str).filter(str => str !== 'cell text').sort(), ['ABCD', 'BC'])
  Y.tryGc(Y.createDeleteSetFromStructStore(doc.store), doc.store, () => true)
  t.assert(um1.undo() !== null)
  um1.clear()
  t.compare(getKeptItems(doc).map(item => item.id), [])
}

/**
 * redoItem can split the item it is redoing: when a neighbour was redone into the middle of it (a
 * merged pair of re-created items). The part that was split off is redone too.
 *
 * @param {t.TestCase} _tc
 */
export const testUndoRedoesWhatRedoItemSplitOff = _tc => {
  const doc = new Y.Doc()
  doc.clientID = 1
  const root = doc.getArray('root')
  const cell = new Y.Text()
  doc.transact(() => {
    root.insert(0, [cell])
    cell.insert(0, 'e')
    cell.insert(0, 'n')
  })
  const um1 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['a']) })
  const um2 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['b']) })
  const um3 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['c']) })
  doc.transact(() => root.delete(0, 1), 'a')
  um1.undo() // re-creates the text, 'n' and 'e'
  doc.transact(() => root.get(0).delete(1, 1), 'b')
  um2.undo() // re-creates 'e', which merges with the re-created 'n'
  doc.transact(() => root.delete(0, 1), 'c')
  t.assert(um3.undo() !== null)
  t.compareStrings(root.get(0).toString(), 'ne')
}

/**
 * clear() releases only what the UndoManager kept. An item that an undo took off the stack but
 * didn't delete keeps the keep flag that something else set.
 *
 * @param {t.TestCase} _tc
 */
export const testClearDoesNotReleaseLiveInsertedItems = _tc => {
  const doc = new Y.Doc()
  const text = doc.getText('text')
  const um = new Y.UndoManager(text, { captureTimeout: 0, deleteFilter: () => false })
  text.insert(0, 'x')
  const item = /** @type {Y.Item} */ (text._start)
  item.keep = true // kept by someone else
  um.undo() // the deleteFilter keeps 'x'
  text.insert(1, 'y') // clears the redo stack
  um.clear()
  t.assert(!item.deleted && item.keep)
}

/**
 * clear() leaves alone a live item that another UndoManager's undo created, even when this
 * UndoManager's undo follows it: that UndoManager, or something else, keeps it.
 *
 * @param {t.TestCase} _tc
 */
export const testClearLeavesLiveItemsOfAnotherUndoManager = _tc => {
  const { doc, root, row, cell } = createTableDoc(true)
  const um1 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['a']) })
  const um2 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['b']) })
  doc.transact(() => cell.insert(0, [new Y.XmlElement('n')]), 'a')
  doc.transact(() => row.delete(0, 1), 'b')
  um2.undo() // re-creates the cell and the node, and keeps the new node
  const node = /** @type {Y.Item} */ (row.get(0).get(0)._item)
  t.assert(!node.deleted && node.keep)
  um1.clear()
  t.assert(node.keep)
  um2.clear()
  t.assert(!node.keep)
}

/**
 * An undo inside a larger transaction records only what the undo created: clear() leaves alone
 * an item the transaction inserted before the undo.
 *
 * @param {t.TestCase} _tc
 */
export const testUndoInsideTransactionRecordsOnlyWhatItCreated = _tc => {
  const doc = new Y.Doc()
  const text = doc.getText('text')
  const um = new Y.UndoManager(text, { captureTimeout: 0, trackedOrigins: new Set(['a']) })
  doc.transact(() => text.insert(0, 'a'), 'a')
  doc.transact(() => text.delete(0, 1), 'a')
  /**
   * @type {Y.Item|null}
   */
  let x = null
  doc.transact(() => {
    text.insert(0, 'x') // not tracked
    x = /** @type {Y.Item} */ (text._start)
    while (x.deleted) x = /** @type {Y.Item} */ (x.right)
    x.keep = true // kept by someone else
    t.assert(um.undo() !== null) // re-creates 'a'
  }, 'other')
  t.compareStrings(text.toString(), 'ax')
  um.clear()
  t.assert(/** @type {any} */ (x).keep)
}

/**
 * A kept item does not merge with an item that is not kept. Otherwise the merged item is kept, and
 * releasing the first item leaves the second one kept.
 *
 * @param {t.TestCase} _tc
 */
export const testKeptItemDoesNotMergeWithUnkeptItem = _tc => {
  const doc = new Y.Doc()
  doc.clientID = 1
  const text = doc.getText('text')
  text.insert(0, 'a')
  const a = /** @type {Y.Item} */ (text._start)
  a.keep = true
  text.insert(1, 'b')
  t.assert(a.length === 1 && a.keep)
  t.assert(a.right !== null && a.right.length === 1 && !a.right.keep)
}

/**
 * Undo and redo on empty stacks record nothing, and clear() has nothing to release afterwards.
 *
 * @param {t.TestCase} _tc
 */
export const testUndoOnEmptyStacksRecordsNothing = _tc => {
  const { root } = createTableDoc(true)
  const um = new Y.UndoManager(root, { captureTimeout: 0 })
  for (let i = 0; i < 100; i++) {
    t.assert(um.undo() === null)
    t.assert(um.redo() === null)
  }
  t.assert(um.poppedStackItems.length === 0)
  let cleared = false
  um.on('stack-cleared', () => { cleared = true })
  um.clear()
  t.assert(!cleared)
}

/**
 * One UndoManager releasing its keeps must not break the undo of another UndoManager on the same
 * document.
 *
 * @param {t.TestCase} _tc
 */
export const testUndoRedoWithTwoUndoManagersInOneNestedType = _tc => {
  for (const gc of [true, false]) {
    const { doc, root, table, text } = createTableDoc(gc)
    const um1 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['a']) })
    const um2 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['b']) })
    doc.transact(() => text.delete(0, 4), 'b') // ' text'
    doc.transact(() => text.insert(5, '!'), 'a') // ' text!'
    um1.undo()
    um1.redo()
    um1.undo()
    um1.redo()
    um1.clear()
    um1.destroy()
    t.compareStrings(text.toString(), ' text!')
    t.assert(getKeptItems(doc).length > 0) // um2 still keeps its deletion
    t.assert(um2.undo() !== null)
    t.compareStrings(text.toString(), 'cell text!')
    t.assert(um2.redo() !== null)
    t.assert(um2.undo() !== null)
    t.compareStrings(text.toString(), 'cell text!')
    um2.clear()
    t.compare(getKeptItems(doc).map(item => item.id), [])
    deleteRootChildrenRemotely(doc)
    if (gc) {
      t.assert(/** @type {Y.Item} */ (table._item).content instanceof Y.ContentDeleted)
    }
  }
}

/**
 * Undo must not throw when a type that an undo restored was deleted remotely and
 * garbage-collected.
 *
 * @see https://github.com/yjs/yjs/issues/809
 * @param {t.TestCase} _tc
 */
export const testUndoAfterRestoredTypeWasCollected = _tc => {
  const doc = new Y.Doc()
  doc.clientID = 1
  const nodes = doc.getMap('nodes')
  doc.transact(() => {
    for (const id of ['n1', 'n2']) {
      const node = new Y.Map()
      node.set('name', 'a')
      nodes.set(id, node)
    }
  })
  const um = new Y.UndoManager([nodes], { trackedOrigins: new Set(['local']), captureTimeout: 0 })
  doc.transact(() => nodes.get('n1').set('name', 'b'), 'local')
  doc.transact(() => nodes.delete('n1'), 'local')
  um.undo() // restores n1 as a new item
  doc.transact(() => nodes.get('n1').set('name', 'c'), 'local')
  um.undo()
  doc.transact(() => nodes.get('n2').set('name', 'x'), 'local') // clears the redo stack
  const remote = new Y.Doc()
  remote.clientID = 2
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc))
  remote.getMap('nodes').delete('n1')
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(doc)), 'remote')
  t.assert(um.undo() !== null) // the change of n2
  um.undo() // the change of n1, which the remote peer deleted: must not throw
  t.compare(nodes.toJSON(), { n2: { name: 'a' } })
}

/**
 * Random undo, redo, clear and destroy sessions on nested types with a collaborator. After every
 * UndoManager is cleared, no item may be kept, and every item that is deleted afterwards must be
 * garbage-collected.
 *
 * @param {t.TestCase} tc
 */
export const testRepeatUndoRedoReleasesKeptItems = tc => {
  const gen = tc.prng
  const gc = prng.bool(gen)
  const doc = new Y.Doc({ gc })
  doc.clientID = 1
  const remote = new Y.Doc({ gc })
  remote.clientID = 2
  const root = doc.getXmlFragment('root')
  const createNode = () => {
    const node = new Y.XmlElement(prng.oneOf(gen, ['table', 'row', 'cell']))
    node.insert(0, [new Y.XmlText(prng.word(gen, 1, 4))])
    return node
  }
  root.insert(0, [createNode(), createNode()])
  const sync = () => {
    const update = Y.encodeStateAsUpdate(doc, Y.encodeStateVector(remote))
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(doc)))
    Y.applyUpdate(remote, update)
  }
  /**
   * @param {Y.Doc} ydoc
   * @return {Array<Y.XmlFragment|Y.XmlText>}
   */
  const liveTypes = ydoc => {
    /**
     * @type {Array<any>}
     */
    const types = [ydoc.getXmlFragment('root')]
    for (let i = 0; i < types.length; i++) {
      if (!(types[i] instanceof Y.XmlText)) types[i].toArray().forEach(/** @param {any} child */ child => types.push(child))
    }
    return types
  }
  const origins = ['a', 'b']
  const ums = origins.map(origin => new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set([origin]) }))
  const allUms = ums.slice()
  for (let i = 0; i < 60; i++) {
    const ui = prng.int32(gen, 0, 1)
    const op = prng.int32(gen, 0, 9)
    if (op <= 2) {
      const type = /** @type {any} */ (prng.oneOf(gen, liveTypes(doc)))
      doc.transact(() => {
        const k = prng.int32(gen, 0, 3)
        if (type instanceof Y.XmlText) {
          if (k === 1 && type.length > 0) {
            const pos = prng.int32(gen, 0, type.length - 1)
            type.delete(pos, prng.int32(gen, 1, type.length - pos))
          } else if (k === 2 && type.length > 0) {
            type.format(0, prng.int32(gen, 1, type.length), { bold: prng.bool(gen) ? true : null })
          } else {
            type.insert(prng.int32(gen, 0, type.length), prng.word(gen, 1, 3))
          }
        } else if (k === 0 && type.length > 0) {
          const pos = prng.int32(gen, 0, type.length - 1)
          type.delete(pos, prng.int32(gen, 1, type.length - pos))
        } else if (k === 1 && type instanceof Y.XmlElement) {
          type.setAttribute(prng.oneOf(gen, ['x', 'y']), prng.word(gen, 1, 2))
        } else {
          type.insert(prng.int32(gen, 0, type.length), [createNode()])
        }
      }, origins[ui])
    } else if (op <= 4) {
      ums[ui].undo()
    } else if (op === 5) {
      ums[ui].redo()
    } else if (op === 6) {
      ums[ui].clear(prng.bool(gen), prng.bool(gen))
    } else if (op === 7) {
      ums[ui].destroy()
      ums[ui] = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set([origins[ui]]) })
      allUms.push(ums[ui])
    } else if (op === 8) {
      const type = /** @type {any} */ (prng.oneOf(gen, liveTypes(remote)))
      if (type.length > 0) type.delete(prng.int32(gen, 0, type.length - 1), 1)
    } else {
      sync()
    }
  }
  sync()
  allUms.forEach(um => um.clear())
  t.compare(getKeptItems(doc).map(item => item.id), [])
  /**
   * @type {Array<Y.ID>}
   */
  const live = []
  doc.store.clients.forEach(structs => structs.forEach(struct => { if (struct instanceof Y.Item && !struct.deleted) live.push(struct.id) }))
  const remoteRoot = remote.getXmlFragment('root')
  remoteRoot.delete(0, remoteRoot.length)
  sync()
  if (gc) {
    live.forEach(id => {
      const struct = Y.getItem(doc.store, id)
      t.assert(!struct.deleted || !(struct instanceof Y.Item) || struct.content instanceof Y.ContentDeleted, 'deleted content is garbage-collected')
    })
  }
}
