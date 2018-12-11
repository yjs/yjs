
import './structs/Item.js'
import { Delete } from './structs/Delete.js'
import { ItemJSON } from './structs/ItemJSON.js'
import { ItemString } from './structs/ItemString.js'
import { ItemFormat } from './structs/ItemFormat.js'
import { ItemEmbed } from './structs/ItemEmbed.js'
import { GC } from './structs/GC.js'

import { YArray } from './types/YArray.js'
import { YMap } from './types/YMap.js'
import { YText } from './types/YText.js'
import { YXmlText } from './types/YXmlText.js'
import { YXmlHook } from './types/YXmlHook.js'
import { YXmlElement, YXmlFragment } from './types/YXmlElement.js'

import { registerStruct } from './utils/structReferences.js'

import * as decoding from './lib/decoding.js'
import * as encoding from './lib/encoding.js'
import * as awarenessProtocol from './protocols/awareness.js'
import * as syncProtocol from './protocols/sync.js'
import * as authProtocol from './protocols/auth.js'

export { decoding, encoding, awarenessProtocol, syncProtocol, authProtocol }

export { Y } from './utils/Y.js'
export { UndoManager } from './utils/UndoManager.js'
export { Transaction } from './utils/Transaction.js'

export { YArray as Array } from './types/YArray.js'
export { YMap as Map } from './types/YMap.js'
export { YText as Text } from './types/YText.js'
export { YXmlText as XmlText } from './types/YXmlText.js'
export { YXmlHook as XmlHook } from './types/YXmlHook.js'
export { YXmlElement as XmlElement, YXmlFragment as XmlFragment } from './types/YXmlElement.js'

export { getRelativePosition, fromRelativePosition } from './utils/relativePosition.js'
export { registerStruct } from './utils/structReferences.js'
export * from './lib/mutex.js'

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
