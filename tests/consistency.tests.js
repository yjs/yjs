
import * as Y from '../src/index.js'
import * as t from 'lib0/testing.js'

/**
 * Client id should be changed when an instance receives updates from another client using the same client id.
 *
 * @param {t.TestCase} tc
 */
export const testClientIdDuplicateChange = tc => {
  const doc1 = new Y.Doc()
  doc1.clientID = 0
  const doc2 = new Y.Doc()
  doc2.clientID = 0
  t.assert(doc2.clientID === doc1.clientID)
  doc1.getArray('a').insert(0, [1, 2])
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))
  t.assert(doc2.clientID !== doc1.clientID)
}
