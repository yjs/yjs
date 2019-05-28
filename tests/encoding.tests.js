import * as t from 'lib0/testing.js'

import {
  contentRefs,
  readContentBinary,
  readContentDeleted,
  readContentString,
  readContentJSON,
  readContentEmbed,
  readContentType,
  readContentFormat
} from '../src/internals.js'

/**
 * @param {t.TestCase} tc
 */
export const testStructReferences = tc => {
  t.assert(contentRefs.length === 8)
  t.assert(contentRefs[1] === readContentDeleted)
  t.assert(contentRefs[2] === readContentJSON)
  t.assert(contentRefs[3] === readContentBinary)
  t.assert(contentRefs[4] === readContentString)
  t.assert(contentRefs[5] === readContentEmbed)
  t.assert(contentRefs[6] === readContentFormat)
  t.assert(contentRefs[7] === readContentType)
}
