import YArray from '../Type/YArray.js'
import YMap from '../Type/YMap.js'
import YText from '../Type/YText.js'
import { YXmlFragment, YXmlElement, YXmlText, YXmlHook } from '../Type/y-xml/y-xml.js'

import Delete from '../Struct/Delete.js'
import ItemJSON from '../Struct/ItemJSON.js'
import ItemString from '../Struct/ItemString.js'
import ItemFormat from '../Struct/ItemFormat.js'
import ItemEmbed from '../Struct/ItemEmbed.js'

const structs = new Map()
const references = new Map()

export function addStruct (reference, structConstructor) {
  structs.set(reference, structConstructor)
  references.set(structConstructor, reference)
}

export function getStruct (reference) {
  return structs.get(reference)
}

export function getReference (typeConstructor) {
  return references.get(typeConstructor)
}

// TODO: reorder (Item* should have low numbers)
addStruct(0, ItemJSON)
addStruct(1, ItemString)
addStruct(10, ItemFormat)
addStruct(11, ItemEmbed)
addStruct(2, Delete)

addStruct(3, YArray)
addStruct(4, YMap)
addStruct(5, YText)
addStruct(6, YXmlFragment)
addStruct(7, YXmlElement)
addStruct(8, YXmlText)
addStruct(9, YXmlHook)
