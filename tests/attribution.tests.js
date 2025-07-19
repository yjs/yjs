/**
 * Testing if encoding/decoding compatibility and integration compatibility is given.
 * We expect that the document always looks the same, even if we upgrade the integration algorithm, or add additional encoding approaches.
 *
 * The v1 documents were generated with Yjs v13.2.0 based on the randomisized tests.
 */

import * as Y from '../src/index.js'
import * as t from 'lib0/testing'
import * as delta from '../src/utils/Delta.js'

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
  t.compare(c1, delta.createTextDelta().insert('hello ').insert('world', null, { delete: [] }))
  let calledObserver = false
  ytext.observe(event => {
    const d = event.getDelta(am)
    t.compare(d, delta.createTextDelta().retain(11).insert('!', null, { insert: [] }))
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
  t.compare(c1, delta.createTextDelta().insert('hello ').insert('world', null, { delete: [] }))
  ytext.applyDelta(delta.createTextDelta().retain(11).insert('content'), am)
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
  t.compare(c1, delta.createTextDelta().insert('hello ').insert('word', null, { insert: [] }))
  ytext.applyDelta(delta.createTextDelta().retain(9).insert('l'), am)
  t.assert(ytext.toString() === 'hello world')
}
