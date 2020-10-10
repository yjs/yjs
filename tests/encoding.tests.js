import * as t from 'lib0/testing.js'
import * as promise from 'lib0/promise.js'

import {
  contentRefs,
  readContentBinary,
  readContentDeleted,
  readContentString,
  readContentJSON,
  readContentEmbed,
  readContentType,
  readContentFormat,
  readContentAny,
  readContentDoc,
  Doc,
  PermanentUserData,
  encodeStateAsUpdate,
  applyUpdate
} from '../src/internals.js'

/**
 * @param {t.TestCase} tc
 */
export const testStructReferences = tc => {
  t.assert(contentRefs.length === 10)
  t.assert(contentRefs[1] === readContentDeleted)
  t.assert(contentRefs[2] === readContentJSON) // TODO: deprecate content json?
  t.assert(contentRefs[3] === readContentBinary)
  t.assert(contentRefs[4] === readContentString)
  t.assert(contentRefs[5] === readContentEmbed)
  t.assert(contentRefs[6] === readContentFormat)
  t.assert(contentRefs[7] === readContentType)
  t.assert(contentRefs[8] === readContentAny)
  t.assert(contentRefs[9] === readContentDoc)
}

/**
 * There is some custom encoding/decoding happening in PermanentUserData.
 * This is why it landed here.
 *
 * @param {t.TestCase} tc
 */
export const testPermanentUserData = async tc => {
  const ydoc1 = new Doc()
  const ydoc2 = new Doc()
  const pd1 = new PermanentUserData(ydoc1)
  const pd2 = new PermanentUserData(ydoc2)
  pd1.setUserMapping(ydoc1, ydoc1.clientID, 'user a')
  pd2.setUserMapping(ydoc2, ydoc2.clientID, 'user b')
  ydoc1.getText().insert(0, 'xhi')
  ydoc1.getText().delete(0, 1)
  ydoc2.getText().insert(0, 'hxxi')
  ydoc2.getText().delete(1, 2)
  await promise.wait(10)
  applyUpdate(ydoc2, encodeStateAsUpdate(ydoc1))
  applyUpdate(ydoc1, encodeStateAsUpdate(ydoc2))

  // now sync a third doc with same name as doc1 and then create PermanentUserData
  const ydoc3 = new Doc()
  applyUpdate(ydoc3, encodeStateAsUpdate(ydoc1))
  const pd3 = new PermanentUserData(ydoc3)
  pd3.setUserMapping(ydoc3, ydoc3.clientID, 'user a')
}
