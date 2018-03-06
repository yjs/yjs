import YArray from '../Types/YArray/YArray.js'
import YMap from '../Types/YMap/YMap.js'
import YText from '../Types/YText/YText.js'
import { YXmlFragment, YXmlElement, YXmlText, YXmlHook } from '../Types/YXml/YXml.js'

import Delete from '../Struct/Delete.js'
import ItemJSON from '../Struct/ItemJSON.js'
import ItemString from '../Struct/ItemString.js'
import ItemFormat from '../Struct/ItemFormat.js'
import ItemEmbed from '../Struct/ItemEmbed.js'

const structs = new Map()
const references = new Map()

export function registerStruct (reference, structConstructor) {
  structs.set(reference, structConstructor)
  references.set(structConstructor, reference)
}

export function getStruct (reference) {
  return structs.get(reference)
}

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
