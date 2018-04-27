
import Y from './Y.js'
import UndoManager from './Util/UndoManager.js'
import { integrateRemoteStructs } from './MessageHandler/integrateRemoteStructs.js'

import { messageToString, messageToRoomname } from './MessageHandler/messageToString.js'

import Connector from './Connector.js'
import Persistence from './Persistence.js'
import YArray from './Types/YArray/YArray.js'
import YMap from './Types/YMap/YMap.js'
import YText from './Types/YText/YText.js'
import { YXmlFragment, YXmlElement, YXmlText, YXmlHook } from './Types/YXml/YXml.js'
import BinaryDecoder from './Util/Binary/Decoder.js'
import { getRelativePosition, fromRelativePosition } from './Util/relativePosition.js'
import { registerStruct } from './Util/structReferences.js'
import TextareaBinding from './Bindings/TextareaBinding/TextareaBinding.js'
import QuillBinding from './Bindings/QuillBinding/QuillBinding.js'
import DomBinding from './Bindings/DomBinding/DomBinding.js'
import { toBinary, fromBinary } from './MessageHandler/binaryEncode.js'

import debug from 'debug'
import domToType from './Bindings/DomBinding/domToType.js'
import { domsToTypes, switchAssociation } from './Bindings/DomBinding/util.js'

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
