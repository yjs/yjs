import YArray from '../Type/YArray.js'
import YMap from '../Type/YMap.js'
import YText from '../Type/YText.js'
import YXml from '../Type/YXml.js'

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

addStruct(0, YArray)
addStruct(1, YMap)
addStruct(2, YText)
addStruct(3, YXml)
addStruct(4, ItemJSON)
addStruct(5, ItemString)
