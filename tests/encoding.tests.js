import * as t from 'lib0/testing.js'

import {
  structRefs,
  structGCRefNumber,
  structBinaryRefNumber,
  structDeletedRefNumber,
  structEmbedRefNumber,
  structFormatRefNumber,
  structJSONRefNumber,
  structStringRefNumber,
  structTypeRefNumber,
  GCRef,
  ItemBinaryRef,
  ItemDeletedRef,
  ItemEmbedRef,
  ItemFormatRef,
  ItemJSONRef,
  ItemStringRef,
  ItemTypeRef
} from '../src/internals.js'

/**
 * @param {t.TestCase} tc
 */
export const testStructReferences = tc => {
  t.assert(structRefs.length === 8)
  t.assert(structRefs[structGCRefNumber] === GCRef)
  t.assert(structRefs[structBinaryRefNumber] === ItemBinaryRef)
  t.assert(structRefs[structDeletedRefNumber] === ItemDeletedRef)
  t.assert(structRefs[structEmbedRefNumber] === ItemEmbedRef)
  t.assert(structRefs[structFormatRefNumber] === ItemFormatRef)
  t.assert(structRefs[structJSONRefNumber] === ItemJSONRef)
  t.assert(structRefs[structStringRefNumber] === ItemStringRef)
  t.assert(structRefs[structTypeRefNumber] === ItemTypeRef)
}
