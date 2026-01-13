/**
 * Testing if encoding/decoding compatibility and integration compatibility is given.
 * We expect that the document always looks the same, even if we upgrade the integration algorithm, or add additional encoding approaches.
 *
 * The v1 documents were generated with Yjs v13.2.0 based on the randomisized tests.
 */

import * as Y from '../src/index.js'
import * as t from 'lib0/testing'
import * as delta from 'lib0/delta'
import { init } from './testHelper.js' // eslint-disable-line

/**
 * @param {t.TestCase} _tc
 */
export const testRelativePositions = _tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get()
  ytext.insert(0, 'hello world')
  const v1 = Y.cloneDoc(ydoc)
  ytext.delete(1, 6)
  ytext.insert(1, 'x')
  const am = Y.createAttributionManagerFromDiff(v1, ydoc)
  const rel = Y.createRelativePositionFromTypeIndex(ytext, 9, 1, am) // pos after "hello wo"
  const abs1 = Y.createAbsolutePositionFromRelativePosition(rel, ydoc, true, am)
  const abs2 = Y.createAbsolutePositionFromRelativePosition(rel, ydoc, true)
  t.assert(abs1?.index === 9)
  t.assert(abs2?.index === 3)
}

/**
 * @param {t.TestCase} _tc
 */
export const testAttributedEvents = _tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get()
  ytext.insert(0, 'hello world')
  const v1 = Y.cloneDoc(ydoc)
  ydoc.transact(() => {
    ytext.delete(6, 5)
  })
  const am = Y.createAttributionManagerFromDiff(v1, ydoc)
  const c1 = ytext.toDelta(am)
  t.compare(c1, delta.create().insert('hello ').insert('world', null, { delete: [] }))
  let calledObserver = false
  ytext.observe(event => {
    const d = event.getDelta(am)
    t.compare(d, delta.create().retain(11).insert('!', null, { insert: [] }))
    calledObserver = true
  })
  ytext.applyDelta(delta.create().retain(11).insert('!'), am)
  t.assert(calledObserver)
}

/**
 * @param {t.TestCase} _tc
 */
export const testInsertionsMindingAttributedContent = _tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get()
  ytext.insert(0, 'hello world')
  const v1 = Y.cloneDoc(ydoc)
  ydoc.transact(() => {
    ytext.delete(6, 5)
  })
  const am = Y.createAttributionManagerFromDiff(v1, ydoc)
  const c1 = ytext.toDelta(am)
  t.compare(c1, delta.create().insert('hello ').insert('world', null, { delete: [] }))
  ytext.applyDelta(delta.create().retain(11).insert('content'), am)
  t.assert(ytext.toString() === 'hello content')
}

/**
 * @param {t.TestCase} _tc
 */
export const testInsertionsIntoAttributedContent = _tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get()
  ytext.insert(0, 'hello ')
  const v1 = Y.cloneDoc(ydoc)
  ydoc.transact(() => {
    ytext.insert(6, 'word')
  })
  const am = Y.createAttributionManagerFromDiff(v1, ydoc)
  const c1 = ytext.toDelta(am)
  t.compare(c1, delta.create().insert('hello ').insert('word', null, { insert: [] }))
  ytext.applyDelta(delta.create().retain(9).insert('l'), am)
  t.assert(ytext.toString() === 'hello world')
}

export const testYdocDiff = () => {
  const ydocStart = new Y.Doc()
  ydocStart.get('text').insert(0, 'hello')
  ydocStart.get('array').insert(0, [1, 2, 3])
  ydocStart.get('map').setAttr('k', 42)
  ydocStart.get('map').setAttr('nested', new Y.Type())
  const ydocUpdated = Y.cloneDoc(ydocStart)
  ydocUpdated.get('text').insert(5, ' world')
  ydocUpdated.get('array').insert(1, ['x'])
  ydocUpdated.get('map').setAttr('newk', 42)
  ydocUpdated.get('map').getAttr('nested').insert(0, [1])
  // @todo add custom attribution
  const d = Y.diffDocsToDelta(ydocStart, ydocUpdated)
  console.log('calculated diff', d.toJSON())
  t.compare(d, delta.create()
    .modifyAttr('text', delta.create().retain(5).insert(' world', null, { insert: [] }))
    .modifyAttr('array', delta.create().retain(1).insert(['x'], null, { insert: [] }))
    .modifyAttr('map', delta.create().setAttr('newk', 42, { insert: [] }).modifyAttr('nested', delta.create().insert([1], null, { insert: [] })))
  )
}

export const testChildListContent = () => {
  const ydocStart = new Y.Doc()
  const ydocUpdated = Y.cloneDoc(ydocStart)
  const yf = new Y.Type('test')
  let calledEvent = 0
  yf.applyDelta(delta.create().insert('test content').setAttr('k', 'v'))

  const yarray = ydocUpdated.get('array')
  yarray.observeDeep(event => {
    calledEvent++
    const d = event.deltaDeep
    const expectedD = delta.create().insert([delta.create('test').insert('test content').setAttr('k', 'v')])
    t.compare(d, expectedD)
  })
  ydocUpdated.get('array').insert(0, [yf])
  t.assert(calledEvent === 1)
  const d = Y.diffDocsToDelta(ydocStart, ydocUpdated)
  console.log('calculated diff', d.toJSON())
  const expected = delta.create()
    .modifyAttr('array', delta.create().insert([delta.create('test').insert('test content', null, { insert: [] }).setAttr('k', 'v', { insert: [] })], null, { insert: [] }))
  t.compare(d.done(), expected.done())
}

/**
 * @param {t.TestCase} tc
 */
export const testAttributionSession1 = tc => {
  const { testConnector, users, text0, text1 } = init(tc, { users: 3 })
  users[0].gc = false
  const globalAttributions = new Y.Attributions()
  const v1 = Y.cloneDoc(users[0])
  users.forEach(user => user.on('update', (update, _, ydoc, tr) => {
    if (!tr.local) return
    const userid = ydoc.clientID.toString()
    const contentIds = Y.createContentIdsFromUpdate(update)
    Y.insertIntoIdMap(globalAttributions.inserts, Y.createIdMapFromIdSet(contentIds.inserts, [Y.createContentAttribute('insert', userid)]))
    Y.insertIntoIdMap(globalAttributions.deletes, Y.createIdMapFromIdSet(contentIds.deletes, [Y.createContentAttribute('delete', userid)]))
  }))
  text0.insert(0, 'a')
  text1.insert(0, 'b')
  testConnector.flushAllMessages()
  const d1 = text0.toDelta(Y.createAttributionManagerFromDiff(v1, users[0], { attrs: globalAttributions }))
  t.compare(d1, delta.create().insert('a', null, { insert: ['0'] }).insert('b', null, { insert: ['1'] }))
  const v2 = Y.cloneDoc(users[0])
  text0.delete(1, 1)
  text1.insert(2, 'c')
  testConnector.flushAllMessages()
  const d2 = text0.toDelta(Y.createAttributionManagerFromDiff(v2, users[0], { attrs: globalAttributions }))
  t.compare(d2, delta.create().insert('a').insert('b', null, { delete: ['0'] }).insert('c', null, { insert: ['1'] }))

  const onlyUser0ChangesAttributed = {
    inserts: Y.filterIdMap(globalAttributions.inserts, attr => attr.name === 'insert' && attr.val === '0'),
    deletes: Y.filterIdMap(globalAttributions.deletes, attr => attr.name === 'delete' && attr.val === '0')
  }
  const amUser0 = new Y.TwosetAttributionManager(onlyUser0ChangesAttributed.inserts, onlyUser0ChangesAttributed.deletes)
  const d3 = text0.toDelta(amUser0)
  t.compare(d3, delta.create().insert('a', null, { insert: ['0'] }).insert('b', null, { delete: ['0'] }).insert('c'))
  Y.undoContentIds(users[0], Y.createContentIdsFromContentMap(onlyUser0ChangesAttributed))

  const d4 = text0.toDelta()
  t.compare(d4, delta.create().insert('bc'))
}
