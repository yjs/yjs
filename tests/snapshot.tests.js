import * as Y from '../src/index.js'
import * as t from 'lib0/testing'
import { init } from './testHelper.js'

/**
 * @param {t.TestCase} _tc
 */
export const testBasic = _tc => {
  const ydoc = new Y.Doc({ gc: false })
  ydoc.getText().insert(0, 'world!')
  const snapshot = Y.snapshot(ydoc)
  ydoc.getText().insert(0, 'hello ')
  const restored = Y.createDocFromSnapshot(ydoc, snapshot)
  t.assert(restored.getText().toString() === 'world!')
}

/**
 * @param {t.TestCase} _tc
 */
export const testBasicXmlAttributes = _tc => {
  const ydoc = new Y.Doc({ gc: false })
  const yxml = ydoc.getMap().set('el', new Y.XmlElement('div'))
  const snapshot1 = Y.snapshot(ydoc)
  yxml.setAttribute('a', '1')
  const snapshot2 = Y.snapshot(ydoc)
  yxml.setAttribute('a', '2')
  t.compare(yxml.getAttributes(), { a: '2' })
  t.compare(yxml.getAttributes(snapshot2), { a: '1' })
  t.compare(yxml.getAttributes(snapshot1), {})
}

/**
 * @param {t.TestCase} _tc
 */
export const testBasicRestoreSnapshot = _tc => {
  const doc = new Y.Doc({ gc: false })
  doc.getArray('array').insert(0, ['hello'])
  const snap = Y.snapshot(doc)
  doc.getArray('array').insert(1, ['world'])

  const docRestored = Y.createDocFromSnapshot(doc, snap)

  t.compare(docRestored.getArray('array').toArray(), ['hello'])
  t.compare(doc.getArray('array').toArray(), ['hello', 'world'])
}

/**
 * @param {t.TestCase} _tc
 */
export const testEmptyRestoreSnapshot = _tc => {
  const doc = new Y.Doc({ gc: false })
  const snap = Y.snapshot(doc)
  snap.sv.set(9999, 0)
  doc.getArray().insert(0, ['world'])

  const docRestored = Y.createDocFromSnapshot(doc, snap)

  t.compare(docRestored.getArray().toArray(), [])
  t.compare(doc.getArray().toArray(), ['world'])

  // now this snapshot reflects the latest state. It shoult still work.
  const snap2 = Y.snapshot(doc)
  const docRestored2 = Y.createDocFromSnapshot(doc, snap2)
  t.compare(docRestored2.getArray().toArray(), ['world'])
}

/**
 * @param {t.TestCase} _tc
 */
export const testRestoreSnapshotWithSubType = _tc => {
  const doc = new Y.Doc({ gc: false })
  doc.getArray('array').insert(0, [new Y.Map()])
  const subMap = doc.getArray('array').get(0)
  subMap.set('key1', 'value1')

  const snap = Y.snapshot(doc)
  subMap.set('key2', 'value2')

  const docRestored = Y.createDocFromSnapshot(doc, snap)

  t.compare(docRestored.getArray('array').toJSON(), [{
    key1: 'value1'
  }])
  t.compare(doc.getArray('array').toJSON(), [{
    key1: 'value1',
    key2: 'value2'
  }])
}

/**
 * @param {t.TestCase} _tc
 */
export const testRestoreDeletedItem1 = _tc => {
  const doc = new Y.Doc({ gc: false })
  doc.getArray('array').insert(0, ['item1', 'item2'])

  const snap = Y.snapshot(doc)
  doc.getArray('array').delete(0)

  const docRestored = Y.createDocFromSnapshot(doc, snap)

  t.compare(docRestored.getArray('array').toArray(), ['item1', 'item2'])
  t.compare(doc.getArray('array').toArray(), ['item2'])
}

/**
 * @param {t.TestCase} _tc
 */
export const testRestoreLeftItem = _tc => {
  const doc = new Y.Doc({ gc: false })
  doc.getArray('array').insert(0, ['item1'])
  doc.getMap('map').set('test', 1)
  doc.getArray('array').insert(0, ['item0'])

  const snap = Y.snapshot(doc)
  doc.getArray('array').delete(1)

  const docRestored = Y.createDocFromSnapshot(doc, snap)

  t.compare(docRestored.getArray('array').toArray(), ['item0', 'item1'])
  t.compare(doc.getArray('array').toArray(), ['item0'])
}

/**
 * @param {t.TestCase} _tc
 */
export const testDeletedItemsBase = _tc => {
  const doc = new Y.Doc({ gc: false })
  doc.getArray('array').insert(0, ['item1'])
  doc.getArray('array').delete(0)
  const snap = Y.snapshot(doc)
  doc.getArray('array').insert(0, ['item0'])

  const docRestored = Y.createDocFromSnapshot(doc, snap)

  t.compare(docRestored.getArray('array').toArray(), [])
  t.compare(doc.getArray('array').toArray(), ['item0'])
}

/**
 * @param {t.TestCase} _tc
 */
export const testDeletedItems2 = _tc => {
  const doc = new Y.Doc({ gc: false })
  doc.getArray('array').insert(0, ['item1', 'item2', 'item3'])
  doc.getArray('array').delete(1)
  const snap = Y.snapshot(doc)
  doc.getArray('array').insert(0, ['item0'])

  const docRestored = Y.createDocFromSnapshot(doc, snap)

  t.compare(docRestored.getArray('array').toArray(), ['item1', 'item3'])
  t.compare(doc.getArray('array').toArray(), ['item0', 'item1', 'item3'])
}

/**
 * @param {t.TestCase} tc
 */
export const testDependentChanges = tc => {
  const { array0, array1, testConnector } = init(tc, { users: 2 })

  if (!array0.doc) {
    throw new Error('no document 0')
  }
  if (!array1.doc) {
    throw new Error('no document 1')
  }

  /**
   * @type {Y.Doc}
   */
  const doc0 = array0.doc
  /**
   * @type {Y.Doc}
   */
  const doc1 = array1.doc

  doc0.gc = false
  doc1.gc = false

  array0.insert(0, ['user1item1'])
  testConnector.syncAll()
  array1.insert(1, ['user2item1'])
  testConnector.syncAll()

  const snap = Y.snapshot(array0.doc)

  array0.insert(2, ['user1item2'])
  testConnector.syncAll()
  array1.insert(3, ['user2item2'])
  testConnector.syncAll()

  const docRestored0 = Y.createDocFromSnapshot(array0.doc, snap)
  t.compare(docRestored0.getArray('array').toArray(), ['user1item1', 'user2item1'])

  const docRestored1 = Y.createDocFromSnapshot(array1.doc, snap)
  t.compare(docRestored1.getArray('array').toArray(), ['user1item1', 'user2item1'])
}

/**
 * @param {t.TestCase} _tc
 */
export const testContainsUpdate = _tc => {
  const ydoc = new Y.Doc()
  /**
   * @type {Array<Uint8Array>}
   */
  const updates = []
  ydoc.on('update', update => {
    updates.push(update)
  })
  const yarr = ydoc.getArray()
  const snapshot1 = Y.snapshot(ydoc)
  yarr.insert(0, [1])
  const snapshot2 = Y.snapshot(ydoc)
  yarr.delete(0, 1)
  const snapshotFinal = Y.snapshot(ydoc)
  t.assert(!Y.snapshotContainsUpdate(snapshot1, updates[0]))
  t.assert(!Y.snapshotContainsUpdate(snapshot2, updates[1]))
  t.assert(Y.snapshotContainsUpdate(snapshot2, updates[0]))
  t.assert(Y.snapshotContainsUpdate(snapshotFinal, updates[0]))
  t.assert(Y.snapshotContainsUpdate(snapshotFinal, updates[1]))
}
