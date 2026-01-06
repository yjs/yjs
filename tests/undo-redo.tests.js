import * as Y from '../src/index.js'
import { init } from './testHelper.js' // eslint-disable-line
import * as t from 'lib0/testing'
import * as delta from 'lib0/delta'

export const testInconsistentFormat = () => {
  /**
   * @param {Y.Doc} ydoc
   */
  const testYjsMerge = ydoc => {
    const content = ydoc.get('text')
    content.format(0, 6, { bold: null })
    content.format(6, 4, { type: 'text' })
    t.compare(content.getContent(), delta.create().insert('Merge Test', { type: 'text' }).insert(' After', { type: 'text', italic: true }).done())
  }
  const initializeYDoc = () => {
    const yDoc = new Y.Doc({ gc: false })
    const content = yDoc.get('text')
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
  t.compare(text0.getContent(), delta.create().insert('b').insert('cxy', { bold: true }).insert('z'))
  undoManager.undo()
  t.compare(text0.getContent(), delta.create().insert('bcxyz'))
  undoManager.redo()
  t.compare(text0.getContent(), delta.create().insert('b').insert('cxy', { bold: true }).insert('z'))
}

/**
 * Test case to fix #241
 * @param {t.TestCase} _tc
 */
export const testEmptyTypeScope = _tc => {
  const ydoc = new Y.Doc()
  const um = new Y.UndoManager([], { doc: ydoc })
  const yarray = ydoc.get()
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
  tmpydoc1.get('restricted').insert(0, [1])
  tmpydoc1.get('public').insert(0, [1])
  const update1 = Y.encodeStateAsUpdate(tmpydoc1)
  const tmpydoc2 = new Y.Doc()
  tmpydoc2.get('public').insert(0, [2])
  const update2 = Y.encodeStateAsUpdate(tmpydoc2)

  const ydoc = new Y.Doc()
  const restrictedType = ydoc.get('restricted')

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
  t.assert(ydoc.get('public').length === 2)
}

/**
 * Test case to fix #241
 * @param {t.TestCase} _tc
 */
export const testGlobalScope = _tc => {
  const ydoc = new Y.Doc()
  const um = new Y.UndoManager(ydoc)
  const yarray = ydoc.get()
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
  const text = doc.get()
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
  map0.setAttr('a', 0)
  const undoManager = new Y.UndoManager(map0)
  map0.setAttr('a', 1)
  undoManager.undo()
  t.assert(map0.getAttr('a') === 0)
  undoManager.redo()
  t.assert(map0.getAttr('a') === 1)
  // testing sub-types and if it can restore a whole type
  const subType = new Y.Type()
  map0.setAttr('a', subType)
  subType.setAttr('x', 42)
  t.compare(map0.toJSON(), /** @type {any} */ ({ a: { x: 42 } }))
  undoManager.undo()
  t.assert(map0.getAttr('a') === 1)
  undoManager.redo()
  t.compare(map0.toJSON(), /** @type {any} */ ({ a: { x: 42 } }))
  testConnector.syncAll()
  // if content is overwritten by another user, undo operations should be skipped
  map1.setAttr('a', 44)
  testConnector.syncAll()
  undoManager.undo()
  t.assert(map0.getAttr('a') === 44)
  undoManager.redo()
  t.assert(map0.getAttr('a') === 44)

  // test setting value multiple times
  map0.setAttr('b', 'initial')
  undoManager.stopCapturing()
  map0.setAttr('b', 'val1')
  map0.setAttr('b', 'val2')
  undoManager.stopCapturing()
  undoManager.undo()
  t.assert(map0.getAttr('b') === 'initial')
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
  const ymap = new Y.Type()
  array0.insert(0, [ymap])
  t.compare(array0.toJSON().children, [{}])
  undoManager.stopCapturing()
  ymap.setAttr('a', 1)
  t.compare(array0.toJSON().children, [{ a: 1 }])
  undoManager.undo()
  t.compare(array0.toJSON().children, [{}])
  undoManager.undo()
  t.compare(array0.toJSON().children, [2, 3, 4, 5, 6])
  undoManager.redo()
  t.compare(array0.toJSON().children, [{}])
  undoManager.redo()
  t.compare(array0.toJSON().children, [{ a: 1 }])
  testConnector.syncAll()
  array1.get(0).set('b', 2)
  testConnector.syncAll()
  t.compare(array0.toJSON().children, [{ a: 1, b: 2 }])
  undoManager.undo()
  t.compare(array0.toJSON().children, [{ b: 2 }])
  undoManager.undo()
  t.compare(array0.toJSON().children, [2, 3, 4, 5, 6])
  undoManager.redo()
  t.compare(array0.toJSON().children, [{ b: 2 }])
  undoManager.redo()
  t.compare(array0.toJSON().children, [{ a: 1, b: 2 }])
}

/**
 * @param {t.TestCase} tc
 */
export const testUndoXml = tc => {
  const { xml0 } = init(tc, { users: 3 })
  const undoManager = new Y.UndoManager(xml0)
  const child = new Y.Type('p')
  xml0.insert(0, [child])
  const textchild = new Y.Type('content')
  child.insert(0, [textchild])
  // format textchild and revert that change
  undoManager.stopCapturing()
  textchild.format(3, 4, { bold: true })
  const v1 = delta.create('UNDEFINED').insert([delta.create('p').insert([delta.create().insert('con').insert('tent', { bold: true }).done()]).done()]).done()
  const v2 = delta.create('UNDEFINED').insert([delta.create('p').insert([delta.create().insert('content').done()]).done()]).done()
  t.compare(xml0.getContentDeep(), v1)
  undoManager.undo()
  t.compare(xml0.getContentDeep(), v2)
  undoManager.redo()
  t.compare(xml0.getContentDeep(), v1)
  xml0.delete(0, 1)
  t.compare(xml0.getContentDeep(), delta.create('UNDEFINED'))
  undoManager.undo()
  t.compare(xml0.getContentDeep(), v1)
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
  const text0 = new Y.Type()
  const text1 = new Y.Type()
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
  const nestedText = new Y.Type('initial text')
  undoManager.stopCapturing()
  text0.insert(0, [nestedText], { bold: true })
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
  const array0 = init(tc, { users: 3 }).array0
  const undoManager = new Y.UndoManager(array0, { deleteFilter: item => !(item instanceof Y.Item) || (item.content instanceof Y.ContentType && item.content.type._map.size === 0) })
  const map0 = new Y.Type()
  map0.setAttr('hi', 1)
  const map1 = new Y.Type()
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

  const yArray = doc.get('array')
  const yArray2 = doc2.get('array')
  const yMap = new Y.Type()
  yMap.setAttr('hello', 'world')
  yArray.push([yMap])
  const yMap2 = new Y.Type()
  yMap2.setAttr('key', 'value')
  yArray.push([yMap2])

  const undoManager = new Y.UndoManager([yArray], { trackedOrigins: new Set([doc.clientID]) })
  const undoManager2 = new Y.UndoManager([doc2.get('array')], { trackedOrigins: new Set([doc2.clientID]) })

  Y.transact(doc, () => yMap2.setAttr('key', 'value modified'), doc.clientID)
  undoManager.stopCapturing()
  Y.transact(doc, () => yMap.setAttr('hello', 'world modified'), doc.clientID)
  Y.transact(doc2, () => yArray2.delete(0), doc2.clientID)
  undoManager2.undo()
  undoManager.undo()
  t.compareStrings(yMap2.getAttr('key'), 'value')
}

/**
 * This issue has been reported in https://github.com/yjs/yjs/issues/317
 * @param {t.TestCase} _tc
 */
export const testUndoNestedUndoIssue = _tc => {
  const doc = new Y.Doc({ gc: false })
  const design = doc.get()
  const undoManager = new Y.UndoManager(design, { captureTimeout: 0 })

  const text = new Y.Type()

  const blocks1 = new Y.Type()
  const blocks1block = new Y.Type()

  doc.transact(() => {
    blocks1block.setAttr('text', 'Type Something')
    blocks1.push([blocks1block])
    text.setAttr('blocks', blocks1block)
    design.setAttr('text', text)
  })

  const blocks2 = new Y.Type()
  const blocks2block = new Y.Type()
  doc.transact(() => {
    blocks2block.setAttr('text', 'Something')
    blocks2.push([blocks2block])
    text.setAttr('blocks', blocks2block)
  })

  const blocks3 = new Y.Type()
  const blocks3block = new Y.Type()
  doc.transact(() => {
    blocks3block.setAttr('text', 'Something Else')
    blocks3.push([blocks3block])
    text.setAttr('blocks', blocks3block)
  })

  t.compare(design.toJSON().attrs, { text: { blocks: { text: 'Something Else' } } })
  undoManager.undo()
  t.compare(design.toJSON().attrs, { text: { blocks: { text: 'Something' } } })
  undoManager.undo()
  t.compare(design.toJSON().attrs, { text: { blocks: { text: 'Type Something' } } })
  undoManager.undo()
  t.compare(design.toJSON().attrs, { })
  undoManager.redo()
  t.compare(design.toJSON().attrs, { text: { blocks: { text: 'Type Something' } } })
  undoManager.redo()
  t.compare(design.toJSON().attrs, { text: { blocks: { text: 'Something' } } })
  undoManager.redo()
  t.compare(design.toJSON().attrs, { text: { blocks: { text: 'Something Else' } } })
}

/**
 * This issue has been reported in https://github.com/yjs/yjs/issues/355
 *
 * @param {t.TestCase} _tc
 */
export const testConsecutiveRedoBug = _tc => {
  const doc = new Y.Doc()
  const yRoot = doc.get()
  const undoMgr = new Y.UndoManager(yRoot)

  let yPoint = new Y.Type()
  yPoint.setAttr('x', 0)
  yPoint.setAttr('y', 0)
  yRoot.setAttr('a', yPoint)
  undoMgr.stopCapturing()

  yPoint.setAttr('x', 100)
  yPoint.setAttr('y', 100)
  undoMgr.stopCapturing()

  yPoint.setAttr('x', 200)
  yPoint.setAttr('y', 200)
  undoMgr.stopCapturing()

  yPoint.setAttr('x', 300)
  yPoint.setAttr('y', 300)
  undoMgr.stopCapturing()

  t.compare(yPoint.toJSON().attrs, { x: 300, y: 300 })

  undoMgr.undo() // x=200, y=200
  t.compare(yPoint.toJSON().attrs, { x: 200, y: 200 })
  undoMgr.undo() // x=100, y=100
  t.compare(yPoint.toJSON().attrs, { x: 100, y: 100 })
  undoMgr.undo() // x=0, y=0
  t.compare(yPoint.toJSON().attrs, { x: 0, y: 0 })
  undoMgr.undo() // nil
  t.compare(yRoot.getAttr('a'), undefined)

  undoMgr.redo() // x=0, y=0
  yPoint = yRoot.getAttr('a')

  t.compare(yPoint.toJSON().attrs, { x: 0, y: 0 })
  undoMgr.redo() // x=100, y=100
  t.compare(yPoint.toJSON().attrs, { x: 100, y: 100 })
  undoMgr.redo() // x=200, y=200
  t.compare(yPoint.toJSON().attrs, { x: 200, y: 200 })
  undoMgr.redo() // expected x=300, y=300, actually nil
  t.compare(yPoint.toJSON().attrs, { x: 300, y: 300 })
}

/**
 * This issue has been reported in https://github.com/yjs/yjs/issues/304
 *
 * @param {t.TestCase} _tc
 */
export const testUndoXmlBug = _tc => {
  const origin = 'origin'
  const doc = new Y.Doc()
  const fragment = doc.get('t')
  const undoManager = new Y.UndoManager(fragment, {
    captureTimeout: 0,
    trackedOrigins: new Set([origin])
  })

  // create element
  doc.transact(() => {
    const e = new Y.Type('test-node')
    e.setAttr('a', '100')
    e.setAttr('b', '0')
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
  const design = doc.get()

  const undoManager = new Y.UndoManager(design, { captureTimeout: 0 })

  const text = new Y.Type()

  const blocks1 = new Y.Type()
  const blocks1block = new Y.Type()
  doc.transact(() => {
    blocks1block.setAttr('text', '1')
    blocks1.push([blocks1block])

    text.setAttr('blocks', blocks1block)
    design.setAttr('text', text)
  })

  const blocks2 = new Y.Type()
  const blocks2block = new Y.Type()
  doc.transact(() => {
    blocks2block.setAttr('text', '2')
    blocks2.push([blocks2block])
    text.setAttr('blocks', blocks2block)
  })

  const blocks3 = new Y.Type()
  const blocks3block = new Y.Type()
  doc.transact(() => {
    blocks3block.setAttr('text', '3')
    blocks3.push([blocks3block])
    text.setAttr('blocks', blocks3block)
  })

  const blocks4 = new Y.Type()
  const blocks4block = new Y.Type()
  doc.transact(() => {
    blocks4block.setAttr('text', '4')
    blocks4.push([blocks4block])
    text.setAttr('blocks', blocks4block)
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
  t.compare(design.toJSON().attrs, { text: { blocks: { text: '4' } } })
}

/**
 * Undo text formatting delete should not corrupt peer state.
 *
 * @see https://github.com/yjs/yjs/issues/392
 * @param {t.TestCase} _tc
 */
export const testUndoDeleteTextFormat = _tc => {
  const doc = new Y.Doc()
  const text = doc.get()
  text.insert(0, 'Attack ships on fire off the shoulder of Orion.')
  const doc2 = new Y.Doc()
  const text2 = doc2.get()
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

  const expect = delta.create()
    .insert('Attack ships ')
    .insert('on fire', { bold: true })
    .insert(' off the shoulder of Orion.')
  t.compare(text.getContent(), expect)
  t.compare(text2.getContent(), expect)
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
  const map1 = doc.get()
  const map2 = doc2.get()
  const um1 = new Y.UndoManager(map1, { ignoreRemoteMapChanges: true })
  map1.setAttr('x', 1)
  map2.setAttr('x', 2)
  map1.setAttr('x', 3)
  map2.setAttr('x', 4)
  um1.undo()
  t.assert(map1.getAttr('x') === 2)
  t.assert(map2.getAttr('x') === 2)
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
  const fragment = doc.get()
  const undoManager = new Y.UndoManager(fragment, { trackedOrigins: new Set([origin]) })
  doc.transact(() => {
    const e = new Y.Type('test')
    e.setAttr('a', '1')
    e.setAttr('b', '2')
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
  map0.setAttr('a', 'a')
  map0.deleteAttr('a')
  map0.setAttr('a', 'b')
  map0.deleteAttr('a')
  map0.setAttr('a', 'c')
  map0.deleteAttr('a')
  map0.setAttr('a', 'd')
  t.compare(map0.toJSON().attrs, { a: 'd' })
  undoManager.undo()
  t.compare(map0.toJSON().attrs, {})
  undoManager.undo()
  t.compare(map0.toJSON().attrs, { a: 'c' })
  undoManager.undo()
  t.compare(map0.toJSON().attrs, {})
  undoManager.undo()
  t.compare(map0.toJSON().attrs, { a: 'b' })
  undoManager.undo()
  t.compare(map0.toJSON().attrs, {})
  undoManager.undo()
  t.compare(map0.toJSON().attrs, { a: 'a' })
}

/**
 * It should expose the StackItem being processed if undoing
 *
 * @param {t.TestCase} _tc
 */
export const testUndoDoingStackItem = async (_tc) => {
  const doc = new Y.Doc()
  const text = doc.get('text')
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
