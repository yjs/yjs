import Delete from '../Struct/Delete.mjs'
import ItemJSON from '../Struct/ItemJSON.mjs'
import ItemString from '../Struct/ItemString.mjs'
import ItemFormat from '../Struct/ItemFormat.mjs'
import ItemEmbed from '../Struct/ItemEmbed.mjs'
import GC from '../Struct/GC.mjs'

import YArray from '../Types/YArray/YArray.mjs'
import YMap from '../Types/YMap/YMap.mjs'
import YText from '../Types/YText/YText.mjs'
import YXmlText from '../Types/YXml/YXmlText.mjs'
import YXmlHook from '../Types/YXml/YXmlHook.mjs'
import YXmlFragment from '../Types/YXml/YXmlFragment.mjs'
import YXmlElement from '../Types/YXml/YXmlElement.mjs'

const structs = new Map()
const references = new Map()

/**
 * Register a new Yjs types. The same type must be defined with the same
 * reference on all clients!
 *
 * @param {Number} reference
 * @param {class} structConstructor
 *
 * @public
 */
export function registerStruct (reference, structConstructor) {
  structs.set(reference, structConstructor)
  references.set(structConstructor, reference)
}

/**
 * @private
 */
export function getStruct (reference) {
  return structs.get(reference)
}

/**
 * @private
 */
export function getStructReference (typeConstructor) {
  return references.get(typeConstructor)
}

// TODO: reorder (Item* should have low numbers)
registerStruct(0, ItemJSON)
registerStruct(1, ItemString)
registerStruct(10, ItemFormat)
registerStruct(11, ItemEmbed)
registerStruct(2, Delete)

registerStruct(3, YArray)
registerStruct(4, YMap)
registerStruct(5, YText)
registerStruct(6, YXmlFragment)
registerStruct(7, YXmlElement)
registerStruct(8, YXmlText)
registerStruct(9, YXmlHook)

registerStruct(12, GC)
