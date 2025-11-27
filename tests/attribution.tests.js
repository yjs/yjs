/**
 * Testing if encoding/decoding compatibility and integration compatibility is given.
 * We expect that the document always looks the same, even if we upgrade the integration algorithm, or add additional encoding approaches.
 *
 * The v1 documents were generated with Yjs v13.2.0 based on the randomisized tests.
 */

import * as Y from '../src/index.js'
import * as t from 'lib0/testing'
import * as delta from 'lib0/delta'

/**
 * @param {t.TestCase} _tc
 */
export const testRelativePositions = _tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText()
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
  const ytext = ydoc.getText()
  ytext.insert(0, 'hello world')
  const v1 = Y.cloneDoc(ydoc)
  ydoc.transact(() => {
    ytext.delete(6, 5)
  })
  const am = Y.createAttributionManagerFromDiff(v1, ydoc)
  const c1 = ytext.getContent(am)
  t.compare(c1, delta.text().insert('hello ').insert('world', null, { delete: [] }))
  let calledObserver = false
  ytext.observe(event => {
    const d = event.getDelta(am)
    t.compare(d, delta.text().retain(11).insert('!', null, { insert: [] }))
    calledObserver = true
  })
  ytext.insert(11, '!')
  t.assert(calledObserver)
}

/**
 * @param {t.TestCase} _tc
 */
export const testInsertionsMindingAttributedContent = _tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText()
  ytext.insert(0, 'hello world')
  const v1 = Y.cloneDoc(ydoc)
  ydoc.transact(() => {
    ytext.delete(6, 5)
  })
  const am = Y.createAttributionManagerFromDiff(v1, ydoc)
  const c1 = ytext.getContent(am)
  t.compare(c1, delta.text().insert('hello ').insert('world', null, { delete: [] }))
  ytext.applyDelta(delta.text().retain(11).insert('content'), am)
  t.assert(ytext.toString() === 'hello content')
}

/**
 * @param {t.TestCase} _tc
 */
export const testInsertionsIntoAttributedContent = _tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText()
  ytext.insert(0, 'hello ')
  const v1 = Y.cloneDoc(ydoc)
  ydoc.transact(() => {
    ytext.insert(6, 'word')
  })
  const am = Y.createAttributionManagerFromDiff(v1, ydoc)
  const c1 = ytext.getContent(am)
  t.compare(c1, delta.text().insert('hello ').insert('word', null, { insert: [] }))
  ytext.applyDelta(delta.text().retain(9).insert('l'), am)
  t.assert(ytext.toString() === 'hello world')
}

export const testYdocDiff = () => {
  const ydocStart = new Y.Doc()
  ydocStart.getText('text').insert(0, 'hello')
  ydocStart.getArray('array').insert(0, [1, 2, 3])
  ydocStart.getMap('map').set('k', 42)
  ydocStart.getMap('map').set('nested', new Y.Array())
  const ydocUpdated = Y.cloneDoc(ydocStart)
  ydocUpdated.getText('text').insert(5, ' world')
  ydocUpdated.getArray('array').insert(1, ['x'])
  ydocUpdated.getMap('map').set('newk', 42)
  ydocUpdated.getMap('map').get('nested').insert(0, [1])
  // @todo add custom attribution
  const d = Y.diffDocsToDelta(ydocStart, ydocUpdated)
  t.compare(d, delta.create()
    .update('text', delta.create().retain(5).insert('world'))
    .update('array', delta.create().retain(1).insert(['x']))
    .update('map', delta.create().set('newk', 42).update('nested', delta.create().insert([1])))
  )
  console.log(d.toJSON())
  debugger
}
