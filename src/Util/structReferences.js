import YArray from '../Type/YArray.js'
import YMap from '../Type/YMap.js'
import YText from '../Type/YText.js'
import YXmlFragment from '../Type/y-xml/YXmlFragment.js'
import YXmlElement from '../Type/y-xml/YXmlElement.js'
import YXmlText from '../Type/y-xml/YXmlText.js'

import Delete from '../Struct/Delete.js'
import ItemJSON from '../Struct/ItemJSON.js'
import ItemString from '../Struct/ItemString.js'

const structs = new Map()
const references = new Map()

function addStruct (reference, structConstructor) {
  structs.set(reference, structConstructor)
  references.set(structConstructor, reference)
}

export function getStruct (reference) {
  return structs.get(reference)
}

export function getReference (typeConstructor) {
  return references.get(typeConstructor)
}

addStruct(0, ItemJSON)
addStruct(1, ItemString)
addStruct(2, Delete)

addStruct(3, YArray)
addStruct(4, YMap)
addStruct(5, YText)
addStruct(6, YXmlFragment)
addStruct(7, YXmlElement)
addStruct(8, YXmlText)
