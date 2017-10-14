
// import debug from 'debug'
export function debug (namespace) {
  return function log (message) {
    console.log(namespace, message)
  }
}

import DeleteStore from './Store/DeleteStore.js'
import OperationStore from './Store/OperationStore.js'
import StateStore from './Store/StateStore.js'
import { generateUserID } from './Util/generateUserID.js'
import RootID from './Util/RootID.js'

import { messageToString, messageToRoomname } from './MessageHandler/messageToString.js'

import Connector from './Connector.js'
import Persistence from './Persistence.js'
import YArray from './Type/YArray.js'
import YMap from './Type/YMap.js'
import YText from './Type/YText.js'
import YXml from './Type/YXml.js'

export default class Y {
  constructor (opts) {
    this.userID = generateUserID()
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
    this._readyToIntegrate = new Map()
  }
  get room () {
    return this.connector.opts.room
  }
  get (name, TypeConstructor) {
    let id = new RootID(name, TypeConstructor)
    let type = this.os.get(id)
    if (type === null) {
      type = new TypeConstructor()
      type._id = id
      type._integrate(this)
    }
    return type
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
    this.os.iterate(null, null, function (struct) {
      struct.destroy()
    })
    this.os = null
    this.ds = null
    this.ss = null
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

Y.Connector = Connector
Y.Persisence = Persistence
Y.Array = YArray
Y.Map = YMap
Y.Text = YText
Y.Xml = YXml

Y.debug = debug
debug.formatters.Y = messageToString
debug.formatters.y = messageToRoomname
