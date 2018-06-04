import BinaryEncoder from '../../Util/Binary/Encoder.mjs'
/* global WebSocket */
import NamedEventHandler from '../../Util/NamedEventHandler.mjs'
import decodeMessage, { messageSS, messageSubscribe, messageStructs } from './decodeMessage.mjs'
import { createMutualExclude } from '../../Util/mutualExclude.mjs'
import { messageCheckUpdateCounter } from './decodeMessage.mjs'

export const STATE_DISCONNECTED = 0 
export const STATE_CONNECTED = 1

export default class WebsocketsConnector extends NamedEventHandler {
  constructor (url = 'ws://localhost:1234') {
    super()
    this.url = url
    this._state = STATE_DISCONNECTED
    this._socket = null
    this._rooms = new Map()
    this._connectToServer = true
    this._reconnectTimeout = 300
    this._mutualExclude = createMutualExclude()
    this._persistence = null
    this.connect()
  }

  getRoom (roomName) {
    return this._rooms.get(roomName) || { y: null, roomName, localUpdateCounter: 1 }
  }

  syncPersistence (persistence) {
    this._persistence = persistence
    if (this._state === STATE_CONNECTED) {
      persistence.getAllDocuments().then(docs => {
        const encoder = new BinaryEncoder()
        docs.forEach(doc => {
          messageCheckUpdateCounter(doc.roomName, encoder, doc.remoteUpdateCounter)
        });
        this.send(encoder)
      })
    }
  }

  connectY (roomName, y) {
    let room = this._rooms.get(roomName)
    if (room !== undefined) {
      throw new Error('Room is already taken! There can be only one Yjs instance per roomName!')
    }
    this._rooms.set(roomName, {
      roomName,
      y,
      localUpdateCounter: 1
    })
    y.on('afterTransaction', (y, transaction) => {
      this._mutualExclude(() => {
        if (transaction.encodedStructsLen > 0) {
          const encoder = new BinaryEncoder()
          const room = this._rooms.get(roomName)
          messageStructs(roomName, y, encoder, transaction.encodedStructs, ++room.localUpdateCounter)
          this.send(encoder)
        }
      })
    })
    if (this._state === STATE_CONNECTED) {
      const encoder = new BinaryEncoder()
      messageSS(roomName, y, encoder)
      messageSubscribe(roomName, y, encoder)
      this.send(encoder)
    }
  }

  _setState (state) {
    this._state = state
    this.emit('stateChanged', {
      state: this.state
    })
  }

  get state () {
    return this._state === STATE_DISCONNECTED ? 'disconnected' : 'connected'
  }

  _onOpen () {
    this._setState(STATE_CONNECTED)
    if (this._persistence === null) {
      const encoder = new BinaryEncoder()
      for (const [roomName, room] of this._rooms) {
        const y = room.y
        messageSS(roomName, y, encoder)
        messageSubscribe(roomName, y, encoder)
      }
      this.send(encoder)
    } else {
      this.syncPersistence(this._persistence)
    }
  }

  send (encoder) {
    if (encoder.length > 0 && this._socket.readyState === WebSocket.OPEN) {
      this._socket.send(encoder.createBuffer())
    }
  }

  _onClose () {
    this._setState(STATE_DISCONNECTED)
    this._socket = null
    if (this._connectToServer) {
      setTimeout(() => {
        if (this._connectToServer) {
          this.connect()
        }
      }, this._reconnectTimeout)
      this.connect()
    }
  }

  _onMessage (message) {
    if (message.data.byteLength > 0) {
      const reply = decodeMessage(this, message.data, null, false, this._persistence)
      this.send(reply)
    }
  }

  disconnect (code = 1000, reason = 'Client manually disconnected') {
    const socket = this._socket
    this._connectToServer = false
    socket.close(code, reason)
  }

  connect () {
    if (this._socket === null) {
      const socket = new WebSocket(this.url)
      socket.binaryType = 'arraybuffer'
      this._socket = socket
      this._connectToServer = true
      // Connection opened
      socket.addEventListener('open', this._onOpen.bind(this))
      socket.addEventListener('close', this._onClose.bind(this))
      socket.addEventListener('message', this._onMessage.bind(this))
    }
  }
}
