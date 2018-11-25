
import { Delete } from './structs/Delete.mjs'
import { ItemJSON } from './structs/ItemJSON.mjs'
import { ItemString } from './structs/ItemString.mjs'
import { ItemFormat } from './structs/ItemFormat.mjs'
import { ItemEmbed } from './structs/ItemEmbed.mjs'
import { GC } from './structs/GC.mjs'

import { YArray } from './types/YArray.mjs'
import { YMap } from './types/YMap.mjs'
import { YText } from './types/YText.mjs'
import { YXmlText } from './types/YXmlText.mjs'
import { YXmlHook } from './types/YXmlHook.mjs'
import { YXmlElement, YXmlFragment } from './types/YXmlElement.mjs'

import { registerStruct } from './utils/structReferences.mjs'

export { Y } from './utils/Y.mjs'
export { UndoManager } from './utils/UndoManager.mjs'
export { Transaction } from './utils/Transaction.mjs'

export { YArray as Array } from './types/YArray.mjs'
export { YMap as Map } from './types/YMap.mjs'
export { YText as Text } from './types/YText.mjs'
export { YXmlText as XmlText } from './types/YXmlText.mjs'
export { YXmlHook as XmlHook } from './types/YXmlHook.mjs'
export { YXmlElement as XmlElement, YXmlFragment as XmlFragment } from './types/YXmlElement.mjs'

export { getRelativePosition, fromRelativePosition } from './utils/relativePosition.mjs'
export { registerStruct } from './utils/structReferences.mjs'
export * from './protocols/syncProtocol.mjs'
export * from './protocols/awarenessProtocol.mjs'
export * from './lib/encoding.mjs'
export * from './lib/decoding.mjs'
export * from './lib/mutex.mjs'

registerStruct(0, GC)
registerStruct(1, ItemJSON)
registerStruct(2, ItemString)
registerStruct(3, ItemFormat)
registerStruct(4, Delete)

registerStruct(5, YArray)
registerStruct(6, YMap)
registerStruct(7, YText)
registerStruct(8, YXmlFragment)
registerStruct(9, YXmlElement)
registerStruct(10, YXmlText)
registerStruct(11, YXmlHook)
registerStruct(12, ItemEmbed)
