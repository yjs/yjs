/**
 * Point-in-time captures via `ContentIds`, the v14 replacement for the v13 `Snapshot` API: render a
 * past state in place, restore it into a fresh doc, and ask whether an update lies within it. Also
 * covers the deprecated `Snapshot` encoding, which is kept so stored snapshots still decode.
 */

import * as Y from '../src/index.js'
import * as t from 'lib0/testing'
import * as prng from 'lib0/prng'
import * as math from 'lib0/math'
import { init, compare, applyRandomTests, capture, rendererAt } from './testHelper.js'
import * as delta from 'lib0/delta'

/**
 * Restores the doc as it was at `full` into a fresh doc.
 *
 * @param {Y.Doc} ydoc
 * @param {ContentIds} full
 */
const restore = (ydoc, full) => {
  if (ydoc.gc) throw new Error('Garbage-collection must be disabled in the origin doc!')
  const restored = new Y.Doc()
  Y.applyUpdate(restored, Y.intersectUpdateWithContentIds(Y.encodeStateAsUpdate(ydoc), full))
  return restored
}

/**
 * Whether every insert and delete of `update` is part of `full`.
 *
 * @param {ContentIds} full
 * @param {Uint8Array} update
 */
const contains = (full, update) => {
  const rest = Y.excludeContentIds(Y.createContentIdsFromUpdate(update), full)
  return rest.inserts.isEmpty() && rest.deletes.isEmpty()
}

/**
 * @param {t.TestCase} _tc
 */
export const testBasic = _tc => {
  const ydoc = new Y.Doc({ gc: false })
  ydoc.get().insert(0, 'world!')
  const snap = Y.createContentIdsFromDoc(ydoc, true)
  ydoc.get().insert(0, 'hello ')
  const restored = restore(ydoc, snap)
  t.assert(restored.get().toDelta().equals(delta.create().insert('world!').done()))
}

/**
 * @param {t.TestCase} _tc
 */
export const testBasicXmlAttributes = _tc => {
  const ydoc = new Y.Doc({ gc: false })
  const yxml = ydoc.get().setAttr('el', new Y.Node('div'))
  const snapshot1 = capture(ydoc)
  yxml.setAttr('a', '1')
  const snapshot2 = capture(ydoc)
  yxml.setAttr('a', '2')
  t.compare(yxml.getAttrs(), { a: '2' })
  t.compare(yxml.toDelta({ renderer: rendererAt(snapshot2) }).toJSON().attrs, { a: { type: 'insert', value: '1' } })
  t.assert(yxml.toDelta({ renderer: rendererAt(snapshot1) }).toJSON().attrs === undefined)
}

/**
 * Overwrites by one client merge into a single deleted item holding one write per clock. When such
 * an item straddles the captured state, the render must pick the newest write the state renders
 * rather than the item's last value, or its first clock's deleted state.
 *
 * @param {t.TestCase} _tc
 */
export const testXmlAttributesMergedOverwrites = _tc => {
  const ydoc = new Y.Doc({ gc: false })
  const yxml = ydoc.get().setAttr('el', new Y.Node('div'))
  yxml.setAttr('a', '1')
  yxml.setAttr('a', '2')
  const snapshot = capture(ydoc)
  yxml.setAttr('a', '3')
  yxml.setAttr('a', '4')
  yxml.setAttr('b', '1')
  yxml.setAttr('b', '2')
  yxml.deleteAttr('b')
  const snapshotDeleted = capture(ydoc)
  yxml.setAttr('b', '3')
  // the overwritten writes of `a` (1..3) merged into one deleted item that straddles `snapshot`
  t.assert(/** @type {any} */ (yxml)._map.get('a').left.length === 3)
  t.compare(yxml.getAttrs(), { a: '4', b: '3' })
  t.compare(yxml.toDelta({ renderer: rendererAt(snapshot) }).toJSON().attrs, { a: { type: 'insert', value: '2' } })
  // `b` was deleted in `snapshotDeleted`; its merged tombstone ('1', '2') must not resurface
  t.compare(yxml.toDelta({ renderer: rendererAt(snapshotDeleted) }).toJSON().attrs, { a: { type: 'insert', value: '4' } })
}

/**
 * @param {t.TestCase} _tc
 */
export const testBasicRestoreSnapshot = _tc => {
  const doc = new Y.Doc({ gc: false })
  doc.get('array').insert(0, ['hello'])
  const snap = Y.createContentIdsFromDoc(doc, true)
  doc.get('array').insert(1, ['world'])

  const docRestored = restore(doc, snap)

  t.compare(docRestored.get('array').toArray(), ['hello'])
  t.compare(doc.get('array').toJSON().children, ['hello', 'world'])
}

/**
 * @param {t.TestCase} _tc
 */
export const testEmptyRestoreSnapshot = _tc => {
  const doc = new Y.Doc({ gc: false })
  const snap = Y.createContentIdsFromDoc(doc, true)
  doc.get().insert(0, ['world'])

  const docRestored = restore(doc, snap)

  t.compare(docRestored.get().toArray(), [])
  t.compare(doc.get().toArray(), ['world'])

  // now this capture reflects the latest state. It should still work.
  const snap2 = Y.createContentIdsFromDoc(doc, true)
  const docRestored2 = restore(doc, snap2)
  t.compare(docRestored2.get().toArray(), ['world'])
}

/**
 * @param {t.TestCase} _tc
 */
export const testRestoreSnapshotWithSubType = _tc => {
  const doc = new Y.Doc({ gc: false })
  doc.get('array').insert(0, [new Y.Node()])
  const subMap = doc.get('array').get(0)
  subMap.setAttr('key1', 'value1')

  const snap = Y.createContentIdsFromDoc(doc, true)
  subMap.setAttr('key2', 'value2')

  const docRestored = restore(doc, snap)

  t.compare(docRestored.get('array').toJSON().children, [{
    attrs: {
      key1: 'value1'
    }
  }])
  t.compare(doc.get('array').toJSON().children, [{
    attrs: {
      key1: 'value1',
      key2: 'value2'
    }
  }])
}

/**
 * @param {t.TestCase} _tc
 */
export const testRestoreDeletedItem1 = _tc => {
  const doc = new Y.Doc({ gc: false })
  doc.get('array').insert(0, ['item1', 'item2'])

  const snap = Y.createContentIdsFromDoc(doc, true)
  doc.get('array').delete(0)

  const docRestored = restore(doc, snap)

  t.compare(docRestored.get('array').toArray(), ['item1', 'item2'])
  t.compare(doc.get('array').toArray(), ['item2'])
}

/**
 * @param {t.TestCase} _tc
 */
export const testRestoreLeftItem = _tc => {
  const doc = new Y.Doc({ gc: false })
  doc.get('array').insert(0, ['item1'])
  doc.get('map').setAttr('test', 1)
  doc.get('array').insert(0, ['item0'])

  const snap = Y.createContentIdsFromDoc(doc, true)
  doc.get('array').delete(1)

  const docRestored = restore(doc, snap)

  t.compare(docRestored.get('array').toArray(), ['item0', 'item1'])
  t.compare(doc.get('array').toArray(), ['item0'])
}

/**
 * @param {t.TestCase} _tc
 */
export const testDeletedItemsBase = _tc => {
  const doc = new Y.Doc({ gc: false })
  doc.get('array').insert(0, ['item1'])
  doc.get('array').delete(0)
  const snap = Y.createContentIdsFromDoc(doc, true)
  doc.get('array').insert(0, ['item0'])

  const docRestored = restore(doc, snap)

  t.compare(docRestored.get('array').toArray(), [])
  t.compare(doc.get('array').toArray(), ['item0'])
}

/**
 * @param {t.TestCase} _tc
 */
export const testDeletedItems2 = _tc => {
  const doc = new Y.Doc({ gc: false })
  doc.get('array').insert(0, ['item1', 'item2', 'item3'])
  doc.get('array').delete(1)
  const snap = Y.createContentIdsFromDoc(doc, true)
  doc.get('array').insert(0, ['item0'])

  const docRestored = restore(doc, snap)

  t.compare(docRestored.get('array').toArray(), ['item1', 'item3'])
  t.compare(doc.get('array').toArray(), ['item0', 'item1', 'item3'])
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

  const snap = Y.createContentIdsFromDoc(array0.doc, true)

  array0.insert(2, ['user1item2'])
  testConnector.syncAll()
  array1.insert(3, ['user2item2'])
  testConnector.syncAll()

  const docRestored0 = restore(array0.doc, snap)
  t.compare(docRestored0.get('array').toArray(), ['user1item1', 'user2item1'])

  const docRestored1 = restore(array1.doc, snap)
  t.compare(docRestored1.get('array').toArray(), ['user1item1', 'user2item1'])
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
  const yarr = ydoc.get()
  const snapshot1 = Y.createContentIdsFromDoc(ydoc, true)
  yarr.insert(0, [1])
  const snapshot2 = Y.createContentIdsFromDoc(ydoc, true)
  yarr.delete(0, 1)
  const snapshotFinal = Y.createContentIdsFromDoc(ydoc, true)
  t.assert(!contains(snapshot1, updates[0]))
  t.assert(!contains(snapshot2, updates[1]))
  t.assert(contains(snapshot2, updates[0]))
  t.assert(contains(snapshotFinal, updates[0]))
  t.assert(contains(snapshotFinal, updates[1]))
}

/**
 * Reported by https://github.com/yjs/yjs/issues/767
 * @param {t.TestCase} _tc
 */
export const testContainsUpdate2 = _tc => {
  const local = new Y.Doc()
  const remote = new Y.Doc()
  local.get('t').insert(0, 'abcdefghij')
  local.get('t').delete(0, 3)
  Y.applyUpdate(remote, Y.encodeStateAsUpdate(local))
  const snap = Y.createContentIdsFromDoc(remote, true)
  local.get('t').delete(0, 3)
  const update = Y.encodeStateAsUpdate(local)
  t.assert(!contains(snap, update))
}

/**
 * The v13 `Snapshot` data structure and its encoding are deprecated but kept, so stored snapshots
 * still decode and compare.
 *
 * @param {t.TestCase} _tc
 */
export const testDeprecatedSnapshotEncodingRoundtrip = _tc => {
  const ydoc = new Y.Doc({ gc: false })
  ydoc.get().insert(0, 'abc')
  ydoc.get().delete(1, 1)
  const snap = Y.snapshot(ydoc)
  t.assert(Y.equalSnapshots(snap, Y.decodeSnapshot(Y.encodeSnapshot(snap))))
  t.assert(Y.equalSnapshots(snap, Y.decodeSnapshotV2(Y.encodeSnapshotV2(snap))))
  t.assert(!Y.equalSnapshots(snap, Y.emptySnapshot))
}

/**
 * A stored v13 `Snapshot` converts into the ContentIds it describes: `[0, clock)` per client of its
 * state vector as inserts (minus the delete set for the visible variant), its delete set as deletes.
 * The result equals a capture of the doc and drives the same recipes.
 *
 * @param {t.TestCase} tc
 */
export const testContentIdsFromSnapshot = tc => {
  const { users, text0, text1, array0, map1, testConnector } = init(tc, { users: 2 })
  users.forEach(u => { u.gc = false })
  text0.insert(0, 'hello world')
  array0.insert(0, [1, 2, 3])
  testConnector.flushAllMessages()
  text1.delete(5, 6)
  map1.setAttr('k', 'v')
  array0.delete(1, 1)
  testConnector.flushAllMessages()
  const doc = users[0]
  const snap = Y.snapshot(doc)
  const full = Y.createContentIdsFromSnapshot(snap, true)
  const visible = Y.createContentIdsFromSnapshot(snap, false)
  t.assert(Y.equalContentIds(full, Y.createContentIdsFromDoc(doc, true)))
  t.assert(Y.equalContentIds(visible, Y.createContentIdsFromDoc(doc, false)))
  t.assert(Y.equalContentIds(Y.createContentIdsFromSnapshot(Y.emptySnapshot, true), Y.createContentIds()))
  // the converted snapshot renders, restores and answers containment like a capture
  const expected = doc.get('text').toDelta().toJSON()
  text0.insert(0, 'later ')
  t.compare(doc.get('text').toDelta({ renderer: rendererAt({ full, visible }) }).toJSON(), expected)
  t.compare(restore(doc, full).get('text').toDelta().toJSON(), expected)
  t.assert(!contains(full, Y.encodeStateAsUpdate(doc)))
}

/**
 * A doc that received content ahead of a gap it has not filled yet integrates a `Skip` placeholder
 * for the gap. A capture must not claim the skipped ids: they are content the doc never held, so
 * rendering with them would restore it and restoring from them would import it.
 *
 * @param {t.TestCase} _tc
 */
export const testCaptureIgnoresSkips = _tc => {
  const source = new Y.Doc({ gc: false })
  source.get('text').insert(0, 'a') // clock 0
  source.get('array').insert(0, [1]) // clock 1
  source.get('map').setAttr('k', 'v') // clock 2
  const client = source.clientID
  const keep = Y.createIdSet()
  keep.add(client, 0, 1)
  keep.add(client, 2, 1)
  const doc = new Y.Doc({ gc: false })
  Y.applyUpdate(doc, Y.intersectUpdateWithContentIds(Y.encodeStateAsUpdate(source), Y.createContentIds(keep, Y.createIdSet())))
  t.assert(doc.store.skips.has(client, 1)) // the gap is a Skip in the store
  const full = Y.createContentIdsFromDoc(doc, true)
  const visible = Y.createContentIdsFromDoc(doc, false)
  for (const ids of [full, visible]) {
    t.assert(ids.inserts.has(client, 0) && ids.inserts.has(client, 2))
    t.assert(!ids.inserts.has(client, 1))
  }
  // the capture describes exactly what renders and what restores
  t.compare(doc.get('map').toDelta({ renderer: rendererAt({ full, visible }) }).toJSON().attrs, { k: { type: 'insert', value: 'v' } })
  t.compare(restore(doc, full).get('map').getAttrs(), { k: 'v' })
}

/**
 * Differential coverage for the ContentIds recipes above: random edits by three users, captures at
 * random points, then — once all are in sync — every capture must render and restore the same
 * state, and answer containment alike, from every user's doc.
 *
 * @param {t.TestCase} tc
 */
export const testRandomPastStates = tc => {
  const { users, testConnector } = init(tc, { users: 3 })
  users.forEach(u => { u.gc = false })
  const gen = tc.prng
  /**
   * @param {Y.Doc} doc
   */
  const read = doc => ({ text: doc.get('text').toDelta().toJSON(), map: doc.get('map').toDelta().toJSON(), array: doc.get('array').toDelta().toJSON() })
  /**
   * @type {Array<ReturnType<typeof capture> & ReturnType<typeof read>>}
   */
  const captures = []
  for (let i = 0; i < 60; i++) {
    const doc = prng.oneOf(gen, users)
    const text = doc.get('text')
    const ymap = doc.get('map')
    const array = doc.get('array')
    const r = prng.real53(gen)
    if (r < 0.25) {
      text.insert(prng.int32(gen, 0, text.length), prng.word(gen, 1, 4))
    } else if (r < 0.35) {
      if (text.length > 0) {
        const pos = prng.int32(gen, 0, text.length - 1)
        text.delete(pos, prng.int32(gen, 1, text.length - pos))
      }
    } else if (r < 0.5) {
      array.insert(prng.int32(gen, 0, array.length), [prng.int32(gen, 0, 9)])
    } else if (r < 0.6) {
      if (array.length > 0) array.delete(prng.int32(gen, 0, array.length - 1), 1)
    } else if (r < 0.75) {
      ymap.setAttr(prng.oneOf(gen, ['one', 'two']), prng.int32(gen, 0, 99))
    } else if (r < 0.82) {
      ymap.deleteAttr(prng.oneOf(gen, ['one', 'two']))
    }
    if (prng.real53(gen) < 0.4) testConnector.flushRandomMessage()
    if (prng.real53(gen) < 0.25) captures.push({ ...capture(doc), ...read(doc) })
  }
  testConnector.flushAllMessages()
  users.forEach(doc => {
    const now = Y.createContentIdsFromDoc(doc, true)
    const update = Y.encodeStateAsUpdate(doc)
    captures.forEach(c => {
      const expected = { text: c.text, map: c.map, array: c.array }
      const renderer = rendererAt(c)
      const rendered = { text: doc.get('text').toDelta({ renderer }).toJSON(), map: doc.get('map').toDelta({ renderer }).toJSON(), array: doc.get('array').toDelta({ renderer }).toJSON() }
      t.compare(rendered, expected)
      t.compare(read(restore(doc, c.full)), expected)
      t.assert(contains(c.full, Y.intersectUpdateWithContentIds(update, c.full)))
      if (!Y.equalContentIds(now, c.full)) t.assert(!contains(c.full, update))
    })
  })
  compare(users)
}

/**
 * A live view of a captured past state (`useRenderer(rendererAt(c))`) stays frozen while the doc
 * changes: content written after the capture is ignored even once it is deleted (no delete ops for
 * content the view never showed), deleted captured content stays restored (retained, not
 * re-inserted), and a map key keeps the value it held at the capture through later overwrites and
 * deletes. After every change the maintained `.delta` equals a fresh render and the captured state.
 * Changes arrive from an editor doc — the view itself is never edited.
 *
 * @param {t.TestCase} _tc
 */
export const testPastStateLiveView = _tc => {
  const editor = new Y.Doc({ gc: false })
  editor.clientID = 1
  const viewer = new Y.Doc({ gc: false })
  editor.on('update', /** @param {Uint8Array} u */ u => Y.applyUpdate(viewer, u))
  editor.get('map').setAttr('k', 'v1')
  editor.get('array').insert(0, [1, 2, 3])
  editor.get('text').insert(0, 'abc') // last before the capture, so the next insert can merge with it
  const types = ['text', 'map', 'array'].map(name => viewer.get(name))
  const expected = types.map(type => type.toDelta({ deep: true }).toJSON())
  const view = rendererAt(capture(viewer))
  types.forEach(type => {
    type.useRenderer(view)
    t.assert(type.delta != null) // start maintaining the cache
  })
  /**
   * @param {string} name
   * @param {() => void} f
   */
  const step = (name, f) => {
    f()
    types.forEach((type, i) => {
      t.compare(type.delta.toJSON(), type.toDelta({ deep: true }).toJSON(), `${name}: the cache equals a fresh render`)
      t.compare(type.delta.toJSON(), expected[i], `${name}: the view shows the captured state`)
    })
  }
  const text = editor.get('text')
  const map = editor.get('map')
  const array = editor.get('array')
  step('typing right after the captured text (merges with it)', () => text.insert(3, 'de'))
  t.assert(/** @type {any} */ (viewer.get('text'))._start.length === 5, 'the insert merged into the captured item')
  step('insert after the capture', () => text.insert(1, 'xy'))
  step('delete content inserted after the capture', () => text.delete(1, 2))
  step('delete captured content', () => text.delete(1, 1))
  step('format captured content', () => text.format(0, 2, { bold: true }))
  step('remove the format again', () => text.format(0, 2, { bold: null }))
  step('delete everything (an item straddling the capture)', () => text.delete(0, text.length))
  step('array: insert after the capture', () => array.insert(1, [9]))
  step('array: delete it', () => array.delete(1, 1))
  step('array: delete captured content', () => array.delete(0, 2))
  step('map: overwrite a captured key', () => map.setAttr('k', 'v2'))
  step('map: delete it', () => map.deleteAttr('k'))
  step('map: write a key absent at the capture', () => map.setAttr('n', 'x'))
  step('map: delete it', () => map.deleteAttr('n'))
  step('map: write the captured key again', () => map.setAttr('k', 'v3'))
}

/**
 * Deleting in a view of an older version (`useRenderer(rendererAt(c))`) deletes that version's
 * content only. Content written after the capture is ignored by the view, so the delete steps over
 * it and the newer content stays untouched — whether it sits in its own item, merged into a
 * captured item, or (custom `renderedContent`) ahead of the rendered part of an item, and whether
 * it is a list item or a map key's newest write. Captured content deleted since is restored in the
 * view and consumes the delete like any other rendered content. The view itself stays frozen.
 *
 * @param {t.TestCase} _tc
 */
export const testDeleteThroughPastStateView = _tc => {
  /**
   * @param {Y.Node<any>} type
   */
  const assertCacheFresh = type => t.compare(type.delta.toJSON(), type.toDelta({ deep: true }).toJSON(), 'the cache equals a fresh render')
  /**
   * @param {string|Array<any>} insert
   */
  const ins = insert => delta.create().insert(/** @type {any} */ (insert)).done().toJSON()
  t.group('text', () => {
    const ydoc = new Y.Doc({ gc: false })
    const text = ydoc.get('text')
    text.insert(0, 'abcd')
    const past = capture(ydoc)
    text.insert(4, 'ef')
    t.assert(/** @type {any} */ (text)._start.length === 6, 'the later insert merged into the captured item')
    text.insert(2, 'XY') // its own item, between captured content
    text.delete(4, 1) // the captured 'c' — the view restores it
    t.compare(text.toDelta().toJSON(), ins('abXYdef'))
    text.useRenderer(rendererAt(past))
    t.compare(text.delta.toJSON(), ins('abcd')) // starts maintaining the cache
    text.delete(0, 4)
    t.compare(text.toDelta({ renderer: null }).toJSON(), ins('XYef'), 'only the older version was deleted')
    t.compare(text.toDelta().toJSON(), ins('abcd'), 'the view stays frozen')
    assertCacheFresh(text)
  })
  t.group('array', () => {
    const ydoc = new Y.Doc({ gc: false })
    const array = ydoc.get('array')
    array.insert(0, [1, 2, 3])
    const past = capture(ydoc)
    array.insert(1, [9])
    array.useRenderer(rendererAt(past))
    t.compare(array.delta.toJSON(), ins([1, 2, 3]))
    array.delete(0, 3)
    t.compare(array.toDelta({ renderer: null }).toJSON(), ins([9]), 'only the older version was deleted')
    t.compare(array.toDelta().toJSON(), ins([1, 2, 3]), 'the view stays frozen')
    assertCacheFresh(array)
  })
  t.group('a custom renderedContent that ignores the start of an item', () => {
    const ydoc = new Y.Doc({ gc: false })
    const text = ydoc.get('text')
    text.insert(0, 'abcdef')
    const renderedContent = Y.createIdSet()
    renderedContent.add(ydoc.clientID, 2, 2) // 'cd'
    text.useRenderer(Y.createAttributionsRenderer(Y.createContentMap(), { renderedContent }))
    t.compare(text.delta.toJSON(), ins('cd'))
    text.delete(0, 1)
    t.compare(text.toDelta({ renderer: null }).toJSON(), ins('abdef'))
    t.compare(text.toDelta().toJSON(), ins('cd'), 'the deleted c is restored')
    text.delete(0, 2) // the restored 'c', then 'd'
    t.compare(text.toDelta({ renderer: null }).toJSON(), ins('abef'))
    t.compare(text.toDelta().toJSON(), ins('cd'))
    assertCacheFresh(text)
  })
  t.group('map', () => {
    const ydoc = new Y.Doc({ gc: false })
    const map = ydoc.get('map')
    map.setAttr('a', 'old')
    map.setAttr('b', 'kept')
    const past = capture(ydoc)
    map.setAttr('a', 'new') // overwrites a captured key
    map.setAttr('n', 'new') // a key absent at the capture
    map.useRenderer(rendererAt(past))
    const shown = /** @type {any} */ ({ a: { type: 'insert', value: 'old' }, b: { type: 'insert', value: 'kept' } })
    t.compare(map.delta.toJSON().attrs, shown)
    map.deleteAttr('a')
    map.deleteAttr('n')
    map.deleteAttr('b')
    t.compare(map.getAttrs(), { a: 'new', n: 'new' }, 'only the older version was deleted')
    t.compare(map.toDelta().toJSON().attrs, shown, 'the view stays frozen')
    assertCacheFresh(map)
  })
}

/**
 * @param {Y.Doc} doc
 * @param {Y.AbstractRenderer?} [renderer]
 */
const readPastStateTypes = (doc, renderer = null) => ['text', 'array', 'map'].map(name => doc.get(name).toDelta({ renderer, deep: true }))

/**
 * The captures a replica took of its own state: a renderer for the past state and the doc's render
 * at that point.
 *
 * @typedef {Array<{ renderer: Y.AbstractRenderer, state: Array<delta.DeltaAny> }>} PastStates
 */

/**
 * Random edits in the `applyRandomTests` style. Every replica captures its own state at random
 * points; `checkPastStates` renders all of a replica's captures on its current doc and expects
 * exactly what the doc rendered at the capture — after any later local or remote edits, deletes,
 * formats, nested types, overwrites and out-of-order delivery.
 *
 * @type {Array<function(Y.Doc,prng.PRNG,PastStates):void>}
 */
const pastStateTransactions = [
  function insertText (user, gen) {
    const text = user.get('text')
    text.insert(prng.int32(gen, 0, text.length), prng.word(gen), prng.oneOf(gen, [undefined, { bold: true }]))
  },
  function insertNode (user, gen) {
    const array = user.get('array')
    const node = new Y.Node('p')
    node.insert(0, prng.word(gen))
    node.setAttr('k', prng.word(gen))
    array.insert(prng.int32(gen, 0, array.length), [node, prng.int32(gen, 0, 9)])
  },
  function editNode (user, gen) {
    const nodes = user.get('array').toArray().filter(c => c instanceof Y.Node)
    if (nodes.length > 0) {
      const node = prng.oneOf(gen, nodes)
      if (prng.bool(gen)) node.insert(prng.int32(gen, 0, node.length), prng.word(gen))
      else node.setAttr('k', prng.word(gen))
    }
  },
  function _delete (user, gen) {
    const type = prng.oneOf(gen, [user.get('text'), user.get('array')])
    if (type.length > 0) {
      const pos = prng.int32(gen, 0, type.length - 1)
      type.delete(pos, prng.int32(gen, 1, math.min(3, type.length - pos)))
    }
  },
  function format (user, gen) {
    const text = user.get('text')
    if (text.length > 0) {
      const pos = prng.int32(gen, 0, text.length - 1)
      text.format(pos, prng.int32(gen, 1, math.min(3, text.length - pos)), { bold: prng.bool(gen) ? true : null })
    }
  },
  function setAttr (user, gen) {
    user.get('map').setAttr(prng.oneOf(gen, ['a', 'b']), prng.bool(gen) ? prng.word(gen) : new Y.Node())
  },
  function deleteAttr (user, gen) {
    user.get('map').deleteAttr(prng.oneOf(gen, ['a', 'b']))
  },
  function capturePastState (user, _gen, past) {
    past.push({ renderer: rendererAt(capture(user)), state: readPastStateTypes(user) })
  },
  function checkPastStates (user, _gen, past) {
    past.forEach(({ renderer, state }) => readPastStateTypes(user, renderer).forEach((d, i) => t.assert(d.equals(state[i]), 'renders the captured state')))
  }
]

/**
 * Rendering a past state requires `gc: false`.
 *
 * @param {Y.Doc} user
 * @return {PastStates}
 */
const initPastStates = user => {
  user.gc = false
  return []
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratePastStates30 = tc => {
  applyRandomTests(tc, pastStateTransactions, 30, initPastStates)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratePastStates300 = tc => {
  applyRandomTests(tc, pastStateTransactions, 300, initPastStates)
}
