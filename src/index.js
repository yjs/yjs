
import Delete from './Struct/Delete.js'
import ItemJSON from './Struct/ItemJSON.js'
import ItemString from './Struct/ItemString.js'
import ItemFormat from './Struct/ItemFormat.js'
import ItemEmbed from './Struct/ItemEmbed.js'
import GC from './Struct/GC.js'

import YArray from './Types/YArray/YArray.js'
import YMap from './Types/YMap/YMap.js'
import YText from './Types/YText/YText.js'
import YXmlText from './Types/YXml/YXmlText.js'
import YXmlHook from './Types/YXml/YXmlHook.js'
import YXmlFragment from './Types/YXml/YXmlFragment.js'
import YXmlElement from './Types/YXml/YXmlElement.js'

import { registerStruct } from './Util/structReferences.js'

export { default as Y } from './Y.js'
export { default as UndoManager } from './Util/UndoManager.js'
export { default as Transaction } from './Util/Transaction.js'

export { default as Array } from './Types/YArray/YArray.js'
export { default as Map } from './Types/YMap/YMap.js'
export { default as Text } from './Types/YText/YText.js'
export { default as XmlText } from './Types/YXml/YXmlText.js'
export { default as XmlHook } from './Types/YXml/YXmlHook.js'
export { default as XmlFragment } from './Types/YXml/YXmlFragment.js'
export { default as XmlElement } from './Types/YXml/YXmlElement.js'

export { getRelativePosition, fromRelativePosition } from './Util/relativePosition.js'
export { registerStruct as registerType } from './Util/structReferences.js'
export { default as TextareaBinding } from './Bindings/TextareaBinding/TextareaBinding.js'
export { default as QuillBinding } from './Bindings/QuillBinding/QuillBinding.js'
export { default as DomBinding } from './Bindings/DomBinding/DomBinding.js'

export { default as domToType } from './Bindings/DomBinding/domToType.js'
export { domsToTypes, switchAssociation } from './Bindings/DomBinding/util.js'
export * from './message.js'
export * from '../lib/encoding.js'
export * from '../lib/decoding.js'
export * from '../lib/mutex.js'

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
