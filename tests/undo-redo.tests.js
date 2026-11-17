import * as Y from '../src/index.js'
import { init } from './testHelper.js' // eslint-disable-line
import * as t from 'lib0/testing'
import * as delta from 'lib0/delta'
import * as prng from 'lib0/prng'

export const testInconsistentFormat = () => {
  /**
   * @param {Y.Doc} ydoc
   */
  const testYjsMerge = ydoc => {
    const content = ydoc.get('text')
    content.format(0, 6, { bold: null })
    content.format(6, 4, { type: 'text' })
    t.compare(content.toDelta(), delta.create().insert('Merge Test', { type: 'text' }).insert(' After', { type: 'text', italic: true }).done())
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
  t.compare(text0.toDelta(), delta.create().insert('b').insert('cxy', { bold: true }).insert('z').done())
  undoManager.undo()
  t.compare(text0.toDelta(), delta.create().insert('bcxyz').done())
  undoManager.redo()
  t.compare(text0.toDelta(), delta.create().insert('b').insert('cxy', { bold: true }).insert('z').done())
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
  const subType = new Y.Node()
  map0.setAttr('a', subType)
  subType.setAttr('x', 42)
  t.compare(map0.toJSON().attrs, /** @type {any} */ ({ a: { attrs: { x: 42 } } }))
  undoManager.undo()
  t.assert(map0.getAttr('a') === 1)
  undoManager.redo()
  t.compare(map0.toJSON().attrs, /** @type {any} */ ({ a: { attrs: { x: 42 } } }))
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
 * Regression: undoing a deletion of an embedded type together with an attribute
 * change on it must restore the attribute consistently for remote peers. The
 * redone attribute item used to keep an origin from the original (deleted)
 * parent, so the value was correct locally but dropped after sync.
 *
 * @param {t.TestCase} tc
 */
export const testUndoEmbeddedTypeAttribute = tc => {
  const { testConnector, text0, text1 } = init(tc, { users: 2 })
  const button = new Y.Node()
  button.setAttr('type', 'button')
  button.setAttr('test', true)
  button.insert(0, 'Click me')
  text0.insert(0, [button])
  testConnector.syncAll()

  const undoManager = new Y.UndoManager(text0)
  undoManager.stopCapturing()
  // change an attribute, then delete the embedded type
  button.setAttr('type', 'paragraph')
  text0.delete(0, 1)
  // undo both operations at once
  undoManager.undo()

  const expected = { type: 'button', test: true }
  t.compare(text0.get(0).getAttrs(), expected)
  testConnector.syncAll()
  // remote peer must converge to the same attributes
  t.compare(text1.get(0).getAttrs(), expected)
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
  const ymap = new Y.Node()
  array0.insert(0, [ymap])
  t.compare(array0.toJSON().children, [{}])
  undoManager.stopCapturing()
  ymap.setAttr('a', 1)
  t.compare(array0.toJSON().children, [{ attrs: { a: 1 } }])
  undoManager.undo()
  t.compare(array0.toJSON().children, [{}])
  undoManager.undo()
  t.compare(array0.toJSON().children, [2, 3, 4, 5, 6])
  undoManager.redo()
  t.compare(array0.toJSON().children, [{}])
  undoManager.redo()
  t.compare(array0.toJSON().children, [{ attrs: { a: 1 } }])
  testConnector.syncAll()
  array1.get(0).setAttr('b', 2)
  testConnector.syncAll()
  t.compare(array0.toJSON().children, [{ attrs: { a: 1, b: 2 } }])
  undoManager.undo()
  t.compare(array0.toJSON().children, [{ attrs: { b: 2 } }])
  undoManager.undo()
  t.compare(array0.toJSON().children, [2, 3, 4, 5, 6])
  undoManager.redo()
  t.compare(array0.toJSON().children, [{ attrs: { b: 2 } }])
  undoManager.redo()
  t.compare(array0.toJSON().children, [{ attrs: { a: 1, b: 2 } }])
}

/**
 * @param {t.TestCase} tc
 */
export const testUndoXml = tc => {
  const { xml0 } = init(tc, { users: 3 })
  const undoManager = new Y.UndoManager(xml0)
  const child = new Y.Node('p')
  xml0.insert(0, [child])
  const textchild = Y.Node.from(delta.create().insert('content'))
  child.insert(0, [textchild])
  // format textchild and revert that change
  undoManager.stopCapturing()
  textchild.format(3, 4, { bold: true })
  const v1 = delta.create().insert([delta.create('p').insert([delta.create().insert('con').insert('tent', { bold: true }).done()]).done()]).done()
  const v2 = delta.create().insert([delta.create('p').insert([delta.create().insert('content').done()]).done()]).done()
  t.compare(xml0.toDeltaDeep(), v1)
  undoManager.undo()
  t.compare(xml0.toDeltaDeep(), v2)
  undoManager.redo()
  t.compare(xml0.toDeltaDeep(), v1)
  xml0.delete(0, 1)
  t.compare(xml0.toDeltaDeep(), delta.create().done())
  undoManager.undo()
  t.compare(xml0.toDeltaDeep(), v1)
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
  const text0 = new Y.Node()
  const text1 = new Y.Node()
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
  const nestedText = Y.Node.from(delta.create().insert('initial text'))
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
  const map0 = new Y.Node()
  map0.setAttr('hi', 1)
  const map1 = new Y.Node()
  array0.insert(0, [map0, map1])
  undoManager.undo()
  t.assert(array0.length === 1)
  array0.get(0)
  t.assert(Array.from(array0.get(0).attrKeys()).length === 1)
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
  const yMap = new Y.Node()
  yMap.setAttr('hello', 'world')
  yArray.push([yMap])
  const yMap2 = new Y.Node()
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

  const text = new Y.Node()

  const blocks1 = new Y.Node()
  const blocks1block = new Y.Node()

  doc.transact(() => {
    blocks1block.setAttr('text', 'Type Something')
    blocks1.push([blocks1block])
    text.setAttr('blocks', blocks1block)
    design.setAttr('text', text)
  })

  const blocks2 = new Y.Node()
  const blocks2block = new Y.Node()
  doc.transact(() => {
    blocks2block.setAttr('text', 'Something')
    blocks2.push([blocks2block])
    text.setAttr('blocks', blocks2block)
  })

  const blocks3 = new Y.Node()
  const blocks3block = new Y.Node()
  doc.transact(() => {
    blocks3block.setAttr('text', 'Something Else')
    blocks3.push([blocks3block])
    text.setAttr('blocks', blocks3block)
  })
  t.compare(design.toDeltaDeep(), delta.from({ text: delta.from({ blocks: delta.from({ text: 'Something Else' }) }) }))
  undoManager.undo()
  t.compare(design.toDeltaDeep(), delta.from({ text: delta.from({ blocks: delta.from({ text: 'Something' }) }) }))
  undoManager.undo()
  t.compare(design.toDeltaDeep(), delta.from({ text: delta.from({ blocks: delta.from({ text: 'Type Something' }) }) }))
  undoManager.undo()
  t.compare(design.toDeltaDeep(), delta.from({}))
  undoManager.redo()
  t.compare(design.toDeltaDeep(), delta.from({ text: delta.from({ blocks: delta.from({ text: 'Type Something' }) }) }))
  undoManager.redo()
  t.compare(design.toDeltaDeep(), delta.from({ text: delta.from({ blocks: delta.from({ text: 'Something' }) }) }))
  undoManager.redo()
  t.compare(design.toDeltaDeep(), delta.from({ text: delta.from({ blocks: delta.from({ text: 'Something Else' }) }) }))
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

  let yPoint = new Y.Node()
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
    const e = new Y.Node('test-node')
    e.setAttr('a', '100')
    e.setAttr('b', '0')
    fragment.insert(fragment.length, [e])
  }, origin)

  // change one attribute
  doc.transact(() => {
    const e = fragment.get(0)
    e.setAttr('a', '200')
  }, origin)

  // change both attributes
  doc.transact(() => {
    const e = fragment.get(0)
    e.setAttr('a', '180')
    e.setAttr('b', '50')
  }, origin)

  undoManager.undo()
  undoManager.undo()
  undoManager.undo()

  undoManager.redo()
  undoManager.redo()
  undoManager.redo()
  t.compare(fragment.toString(), '<test-node a="180" b="50" />')
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

  const text = new Y.Node()

  const blocks1 = new Y.Node()
  const blocks1block = new Y.Node()
  doc.transact(() => {
    blocks1block.setAttr('text', '1')
    blocks1.push([blocks1block])

    text.setAttr('blocks', blocks1block)
    design.setAttr('text', text)
  })

  const blocks2 = new Y.Node()
  const blocks2block = new Y.Node()
  doc.transact(() => {
    blocks2block.setAttr('text', '2')
    blocks2.push([blocks2block])
    text.setAttr('blocks', blocks2block)
  })

  const blocks3 = new Y.Node()
  const blocks3block = new Y.Node()
  doc.transact(() => {
    blocks3block.setAttr('text', '3')
    blocks3.push([blocks3block])
    text.setAttr('blocks', blocks3block)
  })

  const blocks4 = new Y.Node()
  const blocks4block = new Y.Node()
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
  t.compare(design.toJSON().attrs, { text: { attrs: { blocks: { attrs: { text: '4' } } } } })
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
  t.compare(text.toDelta(), expect)
  t.compare(text2.toDelta(), expect)
}

/**
 * Undo text formatting delete should not corrupt peer state.
 *
 * @see https://github.com/yjs/yjs/issues/392
 * @param {t.TestCase} _tc
 */
export const testBehaviorOfIgnoreRemoteAttributeChangesProperty = _tc => {
  const doc = new Y.Doc()
  const doc2 = new Y.Doc()
  doc.on('update', update => Y.applyUpdate(doc2, update, doc))
  doc2.on('update', update => Y.applyUpdate(doc, update, doc2))
  const map1 = doc.get()
  const map2 = doc2.get()
  const um1 = new Y.UndoManager(map1, { ignoreRemoteAttributeChanges: true })
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
    const e = new Y.Node('test')
    e.setAttr('a', '1')
    e.setAttr('b', '2')
    fragment.insert(0, [e])
  })
  t.compareStrings(fragment.toString(), '<test a="1" b="2" />')
  doc.transact(() => {
    // change attribute "b" and delete test-node
    const e = fragment.get(0)
    e.setAttr('b', '3')
    fragment.delete(0)
  }, origin)
  t.compareStrings(fragment.toString(), '')
  undoManager.undo()
  t.compareStrings(fragment.toString(), '<test a="1" b="2" />')
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
  t.compare(map0.toJSON(), {})
  undoManager.undo()
  t.compare(map0.toJSON().attrs, { a: 'c' })
  undoManager.undo()
  t.compare(map0.toJSON(), {})
  undoManager.undo()
  t.compare(map0.toJSON().attrs, { a: 'b' })
  undoManager.undo()
  t.compare(map0.toJSON(), {})
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
 * A table with one row and one cell, created before any UndoManager exists.
 *
 * @param {boolean} gc
 */
const createTableDoc = gc => {
  const doc = new Y.Doc({ gc })
  doc.clientID = 1
  const root = doc.get('root')
  const table = new Y.Node('table')
  const row = new Y.Node('row')
  const cell = new Y.Node('cell')
  root.insert(0, [table])
  table.insert(0, [row])
  row.insert(0, [cell])
  cell.insert(0, 'cell text')
  return { doc, root, table, cell }
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
  const remoteRoot = remote.get('root')
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
 * @type {Array<[string, function({ cell: Y.Node, um: Y.UndoManager }):void, string, any]>}
 */
const nestedUndoRedoFlows = [
  ['insert text, undo, redo', ({ cell, um }) => { cell.insert(4, ' typed'); um.undo(); um.redo() }, 'cell typed text', {}],
  ['delete text, undo', ({ cell, um }) => { cell.delete(1, 2); um.undo() }, 'cell text', {}],
  ['delete text, undo, redo, undo', ({ cell, um }) => { cell.delete(1, 2); um.undo(); um.redo(); um.undo() }, 'cell text', {}],
  ['set attribute, undo, redo', ({ cell, um }) => { cell.setAttr('k', 1); cell.setAttr('k', 2); um.undo(); um.redo() }, 'cell text', { k: 2 }],
  ['set attribute, delete attribute, undo', ({ cell, um }) => { cell.setAttr('k', 1); cell.deleteAttr('k'); um.undo() }, 'cell text', { k: 1 }],
  ['insert array content, undo, redo', ({ cell, um }) => { cell.insert(9, [1, 2]); um.undo(); um.redo() }, 'cell text12', {}],
  ['delete child node, undo', ({ cell, um }) => {
    const span = new Y.Node('span')
    cell.insert(9, [span])
    span.insert(0, 'xml')
    um.stopCapturing()
    cell.delete(9, 1)
    um.undo()
  }, 'cell text<span>xml</span>', {}]
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
    for (const [name, flow, expectedText, expectedAttrs] of nestedUndoRedoFlows) {
      const { doc, root, table, cell } = createTableDoc(gc)
      const um = new Y.UndoManager(root, { captureTimeout: 0 })
      flow({ cell, um })
      t.compareStrings(cell.toString().replace(/^<cell[^>]*>|<\/cell>$/g, ''), expectedText, name)
      t.compare(cell.getAttrs(), expectedAttrs, name)
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
  const { doc, root, table, cell } = createTableDoc(true)
  const paragraph = new Y.Node('paragraph')
  root.insert(1, [paragraph])
  const um = new Y.UndoManager(root, { captureTimeout: 0 })
  cell.delete(1, 2)
  t.assert(um.undo() !== null)
  t.compareStrings(cell.toString(), '<cell>cell text</cell>')
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
  for (let it = /** @type {Y.Item|null} */ (item); it !== null; it = /** @type {Y.Node} */ (it.parent)._item) {
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
    const { doc, root, cell } = createTableDoc(true)
    const um = new Y.UndoManager(root, { captureTimeout: 0 })
    cell.delete(0, 1) // 'ell text'
    cell.delete(4, 5) // 'ell '
    cell.insert(0, 'x') // 'xell '
    um.undo() // 'ell ' (the redo stack item keeps the deleted 'x')
    um.undo() // 'ell text'
    t.compareStrings(cell.toString(), '<cell>ell text</cell>')
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
      t.compareStrings(cell.toString(), '<cell>cell text</cell>')
    }
    if (!clearRedo) {
      while (um.canRedo()) t.assert(um.redo() !== null)
      t.compareStrings(cell.toString(), '<cell>xell </cell>')
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
   * @type {Array<[string, function(Y.Doc, Y.Node, Y.Node, Y.UndoManager):void, string]>}
   */
  const cases = [
    ['the re-created text', (doc, _root, cell, um1) => {
      doc.transact(() => cell.insert(9, '!'), 'a')
      um1.undo()
      um1.redo() // re-creates '!'
      doc.transact(() => cell.delete(9, 1), 'b')
    }, '<cell>cell text!</cell>'],
    ['the cell around re-created text', (doc, root, cell, um1) => {
      doc.transact(() => cell.insert(9, '!'), 'a')
      um1.undo()
      um1.redo() // re-creates '!'
      doc.transact(() => root.get(0).get(0).delete(0, 1), 'b')
    }, '<cell>cell text!</cell>'],
    ['a re-created cell', (doc, _root, _cell, um1) => {
      const row = _root.get(0).get(0)
      doc.transact(() => row.delete(0, 1), 'a')
      um1.undo() // re-creates the cell and its text
      doc.transact(() => row.delete(0, 1), 'b')
    }, '<cell>cell text</cell>']
  ]
  for (const [name, edit, expected] of cases) {
    const { doc, root, cell } = createTableDoc(true)
    const um1 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['a']) })
    const um2 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['b']) })
    edit(doc, root, cell, um1)
    um1.clear()
    // collect everything that nothing keeps
    doc.transact(tr => Y.tryGc(tr, Y.createDeleteSetFromStructStore(doc.store), () => true))
    t.assert(um2.undo() !== null, name)
    t.compareStrings(root.get(0).get(0).get(0).toString(), expected, name)
  }
}

/**
 * An undo of an insertion follows the inserted item through `redone` to the item that replaced it.
 * clear() must not release what another UndoManager's undo still follows.
 *
 * @param {t.TestCase} _tc
 */
export const testClearKeepsWhatAnotherUndoManagerFollows = _tc => {
  const { doc, root, cell } = createTableDoc(true)
  const row = root.get(0).get(0)
  const um1 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['a']) })
  const um2 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['b']) })
  doc.transact(() => cell.insert(0, [new Y.Node('n')]), 'a')
  doc.transact(() => row.delete(0, 1), 'b') // deletes the cell with the inserted node
  um2.undo() // re-creates the cell and the node
  um2.clear()
  // collect everything that nothing keeps
  doc.transact(tr => Y.tryGc(tr, Y.createDeleteSetFromStructStore(doc.store), () => true))
  t.assert(um1.undo() !== null) // follows the node to the re-created one and deletes it
  t.compareStrings(row.get(0).toString(), '<cell>cell text</cell>')
}

/**
 * The item an undo or redo re-created can be split and re-created again. Every deleted part that
 * another UndoManager's undo follows stays kept until that UndoManager is cleared.
 *
 * @param {t.TestCase} _tc
 */
export const testClearKeepsSplitRedoneItems = _tc => {
  const { doc, root, cell } = createTableDoc(true)
  const row = root.get(0).get(0)
  const um1 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['a']) })
  const um2 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['b']) })
  const um3 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['c']) })
  doc.transact(() => cell.insert(0, 'ABCD'), 'a')
  doc.transact(() => row.delete(0, 1), 'b')
  um2.undo() // re-creates the cell and 'ABCD'
  doc.transact(() => row.get(0).delete(1, 2), 'c') // splits the re-created 'ABCD'
  um3.undo() // re-creates 'BC'
  t.compareStrings(row.get(0).toString(), '<cell>ABCDcell text</cell>')
  um2.clear()
  um3.clear()
  // what um1's undo follows from 'ABCD' and that is deleted stays kept: 'ABCD' and the re-created
  // 'BC' that um3's step deleted. The live re-created 'A', 'D' and 'BC' can't be collected.
  t.compare(getKeptItems(doc).filter(item => item.deleted && item.content instanceof Y.ContentString).map(item => /** @type {Y.ContentString} */ (item.content).str).filter(str => str !== 'cell text').sort(), ['ABCD', 'BC'])
  doc.transact(tr => Y.tryGc(tr, Y.createDeleteSetFromStructStore(doc.store), () => true))
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
  const root = doc.get('root')
  const cell = new Y.Node('cell')
  doc.transact(() => {
    root.insert(0, [cell])
    cell.insert(0, 'e')
    cell.insert(0, 'n')
  })
  const um1 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['a']) })
  const um2 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['b']) })
  const um3 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['c']) })
  doc.transact(() => root.delete(0, 1), 'a')
  um1.undo() // re-creates the cell, 'n' and 'e'
  doc.transact(() => root.get(0).delete(1, 1), 'b')
  um2.undo() // re-creates 'e', which merges with the re-created 'n'
  doc.transact(() => root.delete(0, 1), 'c')
  t.assert(um3.undo() !== null)
  t.compareStrings(root.get(0).toString(), '<cell>ne</cell>')
}

/**
 * undoContentIds with ids of a client that this document doesn't know does nothing, and the
 * temporary UndoManager it leaves doesn't break later changes.
 *
 * @param {t.TestCase} _tc
 */
export const testUndoContentIdsOfUnknownClient = _tc => {
  const doc = new Y.Doc()
  doc.clientID = 1
  const remote = new Y.Doc()
  remote.clientID = 99
  remote.get('root').insert(0, 'x')
  Y.undoContentIds(doc, Y.createContentIdsFromUpdate(Y.encodeStateAsUpdate(remote)))
  doc.get('root').insert(0, 'y')
  t.compareStrings(doc.get('root').toString(), 'y')
}

/**
 * clear() releases only what the UndoManager kept. An item that an undo took off the stack but
 * didn't delete keeps the keep flag that something else set.
 *
 * @param {t.TestCase} _tc
 */
export const testClearDoesNotReleaseLiveInsertedItems = _tc => {
  const doc = new Y.Doc()
  const text = doc.get('text')
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
  const { doc, root, cell } = createTableDoc(true)
  const row = root.get(0).get(0)
  const um1 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['a']) })
  const um2 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['b']) })
  doc.transact(() => cell.insert(0, [new Y.Node('n')]), 'a')
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
  const text = doc.get('text')
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
  const text = doc.get('text')
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
    const { doc, root, table, cell } = createTableDoc(gc)
    const um1 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['a']) })
    const um2 = new Y.UndoManager(root, { captureTimeout: 0, trackedOrigins: new Set(['b']) })
    doc.transact(() => cell.delete(0, 4), 'b') // ' text'
    doc.transact(() => cell.insert(5, '!'), 'a') // ' text!'
    um1.undo()
    um1.redo()
    um1.undo()
    um1.redo()
    um1.clear()
    um1.destroy()
    t.compareStrings(cell.toString(), '<cell> text!</cell>')
    t.assert(getKeptItems(doc).length > 0) // um2 still keeps its deletion
    t.assert(um2.undo() !== null)
    t.compareStrings(cell.toString(), '<cell>cell text!</cell>')
    t.assert(um2.redo() !== null)
    t.assert(um2.undo() !== null)
    t.compareStrings(cell.toString(), '<cell>cell text!</cell>')
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
export const testUndoIntoGarbageCollectedRedoneParent = _tc => {
  const doc = new Y.Doc()
  doc.clientID = 1
  const nodes = doc.get('nodes')
  doc.transact(() => {
    for (const id of ['n1', 'n2']) {
      const node = new Y.Node()
      node.setAttr('name', 'a')
      nodes.setAttr(id, node)
    }
  })
  const um = new Y.UndoManager(nodes, { trackedOrigins: new Set(['local']), captureTimeout: 0 })
  doc.transact(() => nodes.getAttr('n1').setAttr('name', 'b'), 'local')
  doc.transact(() => nodes.deleteAttr('n1'), 'local')
  um.undo() // restores n1 as a new item
  doc.transact(() => nodes.getAttr('n1').setAttr('name', 'c'), 'local')
  um.undo()
  doc.transact(() => nodes.getAttr('n2').setAttr('name', 'x'), 'local') // clears the redo stack
  const remote = new Y.Doc()
  remote.clientID = 2
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc))
  remote.get('nodes').deleteAttr('n1')
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote, Y.encodeStateVector(doc)))
  t.assert(um.undo() !== null) // the change of n2
  um.undo() // the change of n1, which the remote peer deleted: must not throw
  t.compare(nodes.toJSON(), { attrs: { n2: { attrs: { name: 'a' } } } })
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
  const root = doc.get('root')
  const createNode = () => {
    const node = new Y.Node(prng.oneOf(gen, ['table', 'row', 'cell']))
    node.insert(0, prng.word(gen, 1, 4))
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
   */
  const liveTypes = ydoc => {
    /**
     * @type {Array<Y.Node>}
     */
    const types = [ydoc.get('root')]
    for (let i = 0; i < types.length; i++) {
      types[i].toArray().forEach(child => { if (child instanceof Y.Node) types.push(child) })
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
      const type = prng.oneOf(gen, liveTypes(doc))
      doc.transact(() => {
        switch (prng.int32(gen, 0, 3)) {
          case 0: type.insert(prng.int32(gen, 0, type.length), prng.word(gen, 1, 3)); break
          case 1: if (type.length > 0) { const pos = prng.int32(gen, 0, type.length - 1); type.delete(pos, prng.int32(gen, 1, type.length - pos)) } break
          case 2: type.insert(prng.int32(gen, 0, type.length), [createNode()]); break
          default: type.setAttr(prng.oneOf(gen, ['x', 'y']), prng.int32(gen, 0, 9))
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
      const type = prng.oneOf(gen, liveTypes(remote))
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
  const remoteRoot = remote.get('root')
  remoteRoot.delete(0, remoteRoot.length)
  sync()
  if (gc) {
    live.forEach(id => {
      const struct = doc.store.getItem(id)
      t.assert(!struct.deleted || !(struct instanceof Y.Item) || struct.content instanceof Y.ContentDeleted, 'deleted content is garbage-collected')
    })
  }
}
