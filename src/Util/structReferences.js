import YArray from '../Type/YArray'
import YMap from '../Type/YMap'
import YText from '../Type/YText'
import YXml from '../Type/YXml'

import ItemJSON from '../Struct/ItemJSON'
import ItemString from '../Struct/ItemString'

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
