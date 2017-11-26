import DeleteStore from './Store/DeleteStore.js'
import OperationStore from './Store/OperationStore.js'
import StateStore from './Store/StateStore.js'
import { generateUserID } from './Util/generateUserID.js'
import RootID from './Util/RootID.js'
import NamedEventHandler from './Util/NamedEventHandler.js'
import UndoManager from './Util/UndoManager.js'

import { messageToString, messageToRoomname } from './MessageHandler/messageToString.js'

import Connector from './Connector.js'
import Persistence from './Persistence.js'
import YArray from './Type/YArray.js'
import YMap from './Type/YMap.js'
import YText from './Type/YText.js'
import { YXmlFragment, YXmlElement, YXmlText } from './Type/y-xml/y-xml.js'
import BinaryDecoder from './Binary/Decoder.js'
import { getRelativePosition, fromRelativePosition } from './Util/relativePosition.js'

import debug from 'debug'
import Transaction from './Transaction.js'

export default class Y extends NamedEventHandler {
  constructor (opts) {
    super()
    this._opts = opts
    this.userID = opts._userID != null ? opts._userID : generateUserID()
    this.share = {}
    this.ds = new DeleteStore(this)
    this.os = new OperationStore(this)
    this.ss = new StateStore(this)
    this.connector = new Y[opts.connector.name](this, opts.connector)
    if (opts.persistence != null) {
      this.persistence = new Y[opts.persistence.name](this, opts.persistence)
      this.persistence.retrieveContent()
    } else {
      this.persistence = null
    }
    this.connected = true
    this._missingStructs = new Map()
    this._readyToIntegrate = []
    this._transaction = null
  }
  _beforeChange () {}
  transact (f, remote = false) {
    let initialCall = this._transaction === null
    if (initialCall) {
      this._transaction = new Transaction(this)
      this.emit('beforeTransaction', this, this._transaction, remote)
    }
    try {
      f(this)
    } catch (e) {
      console.error(e)
    }
    if (initialCall) {
      this.emit('beforeObserverCalls', this, this._transaction, remote)
      const transaction = this._transaction
      this._transaction = null
      // emit change events on changed types
      transaction.changedTypes.forEach(function (subs, type) {
        if (!type._deleted) {
          type._callObserver(transaction, subs, remote)
        }
      })
      transaction.changedParentTypes.forEach(function (events, type) {
        if (!type._deleted) {
          events = events
            .filter(event =>
              !event.target._deleted
            )
          events
            .forEach(event => {
              event.currentTarget = type
            })
          // we don't have to check for events.length
          // because there is no way events is empty..
          type._deepEventHandler.callEventListeners(transaction, events)
        }
      })
      // when all changes & events are processed, emit afterTransaction event
      this.emit('afterTransaction', this, transaction, remote)
    }
  }
  // fake _start for root properties (y.set('name', type))
  get _start () {
    return null
  }
  set _start (start) {
    return null
  }
  get room () {
    return this._opts.connector.room
  }
  define (name, TypeConstructor) {
    let id = new RootID(name, TypeConstructor)
    let type = this.os.get(id)
    if (this.share[name] === undefined) {
      this.share[name] = type
    } else if (this.share[name] !== type) {
      throw new Error('Type is already defined with a different constructor')
    }
    return type
  }
  get (name) {
    return this.share[name]
  }
  disconnect () {
    if (this.connected) {
      this.connected = false
      return this.connector.disconnect()
    } else {
      return Promise.resolve()
    }
  }
  reconnect () {
    if (!this.connected) {
      this.connected = true
      return this.connector.reconnect()
    } else {
      return Promise.resolve()
    }
  }
  destroy () {
    this.share = null
    if (this.connector.destroy != null) {
      this.connector.destroy()
    } else {
      this.connector.disconnect()
    }
    this.os = null
    this.ds = null
    this.ss = null
  }
  whenSynced () {
    return new Promise(resolve => {
      this.once('synced', () => {
        resolve()
      })
    })
  }
}

Y.extend = function extendYjs () {
  for (var i = 0; i < arguments.length; i++) {
    var f = arguments[i]
    if (typeof f === 'function') {
      f(Y)
    } else {
      throw new Error('Expected a function!')
    }
  }
}

// TODO: The following assignments should be moved to yjs-dist
Y.AbstractConnector = Connector
Y.Persisence = Persistence
Y.Array = YArray
Y.Map = YMap
Y.Text = YText
Y.XmlElement = YXmlElement
Y.XmlFragment = YXmlFragment
Y.XmlText = YXmlText

Y.utils = {
  BinaryDecoder,
  UndoManager,
  getRelativePosition,
  fromRelativePosition
}

Y.debug = debug
debug.formatters.Y = messageToString
debug.formatters.y = messageToRoomname
