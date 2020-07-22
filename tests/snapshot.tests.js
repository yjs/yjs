import { createDocFromSnapshot, Doc, snapshot, YMap } from '../src/internals'
import * as t from 'lib0/testing.js'

/**
 * @param {t.TestCase} tc
 */
export const testBasicRestoreSnapshot = tc => {
  const doc = new Doc({ gc: false })
  doc.getArray('array').insert(0, ['hello'])
  const snap = snapshot(doc)
  doc.getArray('array').insert(1, ['world'])

  const docRestored = createDocFromSnapshot(doc, snap)

  t.compare(docRestored.getArray('array').toArray(), ['hello'])
  t.compare(doc.getArray('array').toArray(), ['hello', 'world'])
}

/**
 * @param {t.TestCase} tc
 */
export const testRestoreSnapshotWithSubType = tc => {
  const doc = new Doc({ gc: false })
  doc.getArray('array').insert(0, [new YMap()])
  const subMap = doc.getArray('array').get(0)
  subMap.set('key1', 'value1')

  const snap = snapshot(doc)
  subMap.set('key2', 'value2')

  const docRestored = createDocFromSnapshot(doc, snap)

  t.compare(docRestored.getArray('array').toJSON(), [{
    key1: 'value1'
  }])
  t.compare(doc.getArray('array').toJSON(), [{
    key1: 'value1',
    key2: 'value2'
  }])
}

/**
 * @param {t.TestCase} tc
 */
export const testRestoreDeletedItem1 = tc => {
  const doc = new Doc({ gc: false })
  doc.getArray('array').insert(0, ['item1', 'item2'])

  const snap = snapshot(doc)
  doc.getArray('array').delete(0)

  const docRestored = createDocFromSnapshot(doc, snap)

  t.compare(docRestored.getArray('array').toArray(), ['item1', 'item2'])
  t.compare(doc.getArray('array').toArray(), ['item2'])
}

/**
 * @param {t.TestCase} tc
 */
export const testRestoreLeftItem = tc => {
  const doc = new Doc({ gc: false })
  doc.getArray('array').insert(0, ['item1'])
  doc.getMap('map').set('test', 1)
  doc.getArray('array').insert(0, ['item0'])

  const snap = snapshot(doc)
  doc.getArray('array').delete(1)

  const docRestored = createDocFromSnapshot(doc, snap)

  t.compare(docRestored.getArray('array').toArray(), ['item0', 'item1'])
  t.compare(doc.getArray('array').toArray(), ['item0'])
}


/**
 * @param {t.TestCase} tc
 */
export const testDeletedItemsBase = tc => {
  const doc = new Doc({ gc: false })
  doc.getArray('array').insert(0, ['item1'])
  doc.getArray('array').delete(0)
  const snap = snapshot(doc)
  doc.getArray('array').insert(0, ['item0'])

  const docRestored = createDocFromSnapshot(doc, snap)

  t.compare(docRestored.getArray('array').toArray(), [])
  t.compare(doc.getArray('array').toArray(), ['item0'])
}



/**
 * @param {t.TestCase} tc
 */
export const testDeletedItems2 = tc => {
  const doc = new Doc({ gc: false })
  doc.getArray('array').insert(0, ['item1', 'item2', 'item3'])
  doc.getArray('array').delete(1)
  const snap = snapshot(doc)
  doc.getArray('array').insert(0, ['item0'])

  const docRestored = createDocFromSnapshot(doc, snap)

  t.compare(docRestored.getArray('array').toArray(), ['item1', 'item3'])
  t.compare(doc.getArray('array').toArray(), ['item0', 'item1', 'item3'])
}

