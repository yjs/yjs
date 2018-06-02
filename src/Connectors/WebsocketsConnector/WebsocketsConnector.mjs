import BinaryEncoder from '../../Util/Binary/Encoder.mjs'
/* global WebSocket */
import NamedEventHandler from '../../Util/NamedEventHandler.mjs'
import decodeMessage, { messageSS, messageSubscribe, messageStructs } from './decodeMessage.mjs'
import { createMutualExclude } from '../../Util/mutualExclude.mjs'

export const STATE_CONNECTING = 0
export const STATE_SYNCING = 1
export const STATE_SYNCED = 2
export const STATE_DISCONNECTED = 3

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
    this.connect()
  }

  getRoom (roomName) {
    return this._rooms.get(roomName)
  }

  connectY (roomName, y) {
    let room = this._rooms.get(roomName)
    if (room !== undefined) {
      throw new Error('Room is already taken! There can be only one Yjs instance per roomName!')
    }
    this._rooms.set(roomName, {
      roomName,
      y
    })
    y.on('afterTransaction', (y, transaction) => {
      this._mutualExclude(() => {
        if (transaction.encodedStructsLen > 0) {
          const encoder = new BinaryEncoder()
          messageStructs(roomName, y, encoder, transaction.encodedStructs)
          this.send(encoder)
        }
      })
    })
  }

  _setState (state) {
    this.emit('stateChanged', {
      state
    })
    this._state = state
  }

  get state () {
    return this._state
  }

  _onOpen () {
    const encoder = new BinaryEncoder()
    for (const [roomName, room] of this._rooms) {
      const y = room.y
      messageSS(roomName, y, encoder)
      messageSubscribe(roomName, y, encoder)
    }
    this.send(encoder)
  }

  send (encoder) {
    if (encoder.length > 0 && this._socket.readyState === WebSocket.OPEN) {
      this._socket.send(encoder.createBuffer())
    }
  }

  _onClose () {
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
      const reply = decodeMessage(this, message.data, null)
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
