
import Y from './Y.mjs'
import UndoManager from './Util/UndoManager.mjs'
import { integrateRemoteStructs } from './MessageHandler/integrateRemoteStructs.mjs'

import { messageToString, messageToRoomname } from './MessageHandler/messageToString.mjs'

import Connector from './Connector.mjs'
import Persistence from './Persistence.mjs'
import YArray from './Types/YArray/YArray.mjs'
import YMap from './Types/YMap/YMap.mjs'
import YText from './Types/YText/YText.mjs'
import YXmlText from './Types/YXml/YXmlText.mjs'
import YXmlHook from './Types/YXml/YXmlHook.mjs'
import YXmlFragment from './Types/YXml/YXmlFragment.mjs'
import YXmlElement from './Types/YXml/YXmlElement.mjs'
import BinaryDecoder from './Util/Binary/Decoder.mjs'
import { getRelativePosition, fromRelativePosition } from './Util/relativePosition.mjs'
import { registerStruct } from './Util/structReferences.mjs'
import TextareaBinding from './Bindings/TextareaBinding/TextareaBinding.mjs'
import QuillBinding from './Bindings/QuillBinding/QuillBinding.mjs'
import DomBinding from './Bindings/DomBinding/DomBinding.mjs'
import { toBinary, fromBinary } from './MessageHandler/binaryEncode.mjs'

import debug from 'debug'
import domToType from './Bindings/DomBinding/domToType.mjs'
import { domsToTypes, switchAssociation } from './Bindings/DomBinding/util.mjs'

// TODO: The following assignments should be moved to yjs-dist
Y.AbstractConnector = Connector
Y.AbstractPersistence = Persistence
Y.Array = YArray
Y.Map = YMap
Y.Text = YText
Y.XmlElement = YXmlElement
Y.XmlFragment = YXmlFragment
Y.XmlText = YXmlText
Y.XmlHook = YXmlHook

Y.TextareaBinding = TextareaBinding
Y.QuillBinding = QuillBinding
Y.DomBinding = DomBinding

DomBinding.domToType = domToType
DomBinding.domsToTypes = domsToTypes
DomBinding.switchAssociation = switchAssociation

Y.utils = {
  BinaryDecoder,
  UndoManager,
  getRelativePosition,
  fromRelativePosition,
  registerStruct,
  integrateRemoteStructs,
  toBinary,
  fromBinary
}

Y.debug = debug
debug.formatters.Y = messageToString
debug.formatters.y = messageToRoomname
export default Y
