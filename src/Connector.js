import BinaryEncoder from './Util/Binary/Encoder.js'
import BinaryDecoder from './Util/Binary/Decoder.js'

import { sendSyncStep1, readSyncStep1 } from './MessageHandler/syncStep1.js'
import { readSyncStep2 } from './MessageHandler/syncStep2.js'
import { integrateRemoteStructs } from './MessageHandler/integrateRemoteStructs.js'

// TODO: reintroduce or remove
// import debug from 'debug'

// TODO: rename Connector

export default class AbstractConnector {
  constructor (y, opts) {
    this.y = y
    this.opts = opts
    if (opts.role == null || opts.role === 'master') {
      this.role = 'master'
    } else if (opts.role === 'slave') {
      this.role = 'slave'
    } else {
      throw new Error("Role must be either 'master' or 'slave'!")
    }
    this.log = debug('y:connector')
    this.logMessage = debug('y:connector-message')
    this._forwardAppliedStructs = opts.forwardAppliedOperations || false // TODO: rename
    this.role = opts.role
    this.connections = new Map()
    this.isSynced = false
    this.userEventListeners = []
    this.whenSyncedListeners = []
    this.currentSyncTarget = null
    this.debug = opts.debug === true
    this.broadcastBuffer = new BinaryEncoder()
    this.broadcastBufferSize = 0
    this.protocolVersion = 11
    this.authInfo = opts.auth || null
    this.checkAuth = opts.checkAuth || function () { return Promise.resolve('write') } // default is everyone has write access
    if (opts.maxBufferLength == null) {
      this.maxBufferLength = -1
    } else {
      this.maxBufferLength = opts.maxBufferLength
    }
  }

  reconnect () {
    this.log('reconnecting..')
  }

  disconnect () {
    this.log('discronnecting..')
    this.connections = new Map()
    this.isSynced = false
    this.currentSyncTarget = null
    this.whenSyncedListeners = []
    return Promise.resolve()
  }

  onUserEvent (f) {
    this.userEventListeners.push(f)
  }

  removeUserEventListener (f) {
    this.userEventListeners = this.userEventListeners.filter(g => f !== g)
  }

  userLeft (user) {
    if (this.connections.has(user)) {
      this.log('%s: User left %s', this.y.userID, user)
      this.connections.delete(user)
      // check if isSynced event can be sent now
      this._setSyncedWith(null)
      for (var f of this.userEventListeners) {
        f({
          action: 'userLeft',
          user: user
        })
      }
    }
  }

  userJoined (user, role, auth) {
    if (role == null) {
      throw new Error('You must specify the role of the joined user!')
    }
    if (this.connections.has(user)) {
      throw new Error('This user already joined!')
    }
    this.log('%s: User joined %s', this.y.userID, user)
    this.connections.set(user, {
      uid: user,
      isSynced: false,
      role: role,
      processAfterAuth: [],
      processAfterSync: [],
      auth: auth || null,
      receivedSyncStep2: false
    })
    let defer = {}
    defer.promise = new Promise(function (resolve) { defer.resolve = resolve })
    this.connections.get(user).syncStep2 = defer
    for (var f of this.userEventListeners) {
      f({
        action: 'userJoined',
        user: user,
        role: role
      })
    }
    this._syncWithUser(user)
  }

  // Execute a function _when_ we are connected.
  // If not connected, wait until connected
  whenSynced (f) {
    if (this.isSynced) {
      f()
    } else {
      this.whenSyncedListeners.push(f)
    }
  }

  _syncWithUser (userID) {
    if (this.role === 'slave') {
      return // "The current sync has not finished or this is controlled by a master!"
    }
    sendSyncStep1(this, userID)
  }

  _fireIsSyncedListeners () {
    if (!this.isSynced) {
      this.isSynced = true
      // It is safer to remove this!
      // call whensynced listeners
      for (var f of this.whenSyncedListeners) {
        f()
      }
      this.whenSyncedListeners = []
      this.y._setContentReady()
      this.y.emit('synced')
    }
  }

  send (uid, buffer) {
    const y = this.y
    if (!(buffer instanceof ArrayBuffer || buffer instanceof Uint8Array)) {
      throw new Error('Expected Message to be an ArrayBuffer or Uint8Array - don\'t use this method to send custom messages')
    }
    this.log('User%s to User%s: Send \'%y\'', y.userID, uid, buffer)
    this.logMessage('User%s to User%s: Send %Y', y.userID, uid, [y, buffer])
  }

  broadcast (buffer) {
    const y = this.y
    if (!(buffer instanceof ArrayBuffer || buffer instanceof Uint8Array)) {
      throw new Error('Expected Message to be an ArrayBuffer or Uint8Array - don\'t use this method to send custom messages')
    }
    this.log('User%s: Broadcast \'%y\'', y.userID, buffer)
    this.logMessage('User%s: Broadcast: %Y', y.userID, [y, buffer])
  }

  /*
    Buffer operations, and broadcast them when ready.
  */
  broadcastStruct (struct) {
    const firstContent = this.broadcastBuffer.length === 0
    if (firstContent) {
      this.broadcastBuffer.writeVarString(this.y.room)
      this.broadcastBuffer.writeVarString('update')
      this.broadcastBufferSize = 0
      this.broadcastBufferSizePos = this.broadcastBuffer.pos
      this.broadcastBuffer.writeUint32(0)
    }
    this.broadcastBufferSize++
    struct._toBinary(this.broadcastBuffer)
    if (this.maxBufferLength > 0 && this.broadcastBuffer.length > this.maxBufferLength) {
      // it is necessary to send the buffer now
      // cache the buffer and check if server is responsive
      const buffer = this.broadcastBuffer
      buffer.setUint32(this.broadcastBufferSizePos, this.broadcastBufferSize)
      this.broadcastBuffer = new BinaryEncoder()
      this.whenRemoteResponsive().then(() => {
        this.broadcast(buffer.createBuffer())
      })
    } else if (firstContent) {
      // send the buffer when all transactions are finished
      // (or buffer exceeds maxBufferLength)
      setTimeout(() => {
        if (this.broadcastBuffer.length > 0) {
          const buffer = this.broadcastBuffer
          buffer.setUint32(this.broadcastBufferSizePos, this.broadcastBufferSize)
          this.broadcast(buffer.createBuffer())
          this.broadcastBuffer = new BinaryEncoder()
        }
      }, 0)
    }
  }

  /*
   * Somehow check the responsiveness of the remote clients/server
   * Default behavior:
   *   Wait 100ms before broadcasting the next batch of operations
   *
   * Only used when maxBufferLength is set
   *
   */
  whenRemoteResponsive () {
    return new Promise(function (resolve) {
      setTimeout(resolve, 100)
    })
  }

  /*
    You received a raw message, and you know that it is intended for Yjs. Then call this function.
  */
  receiveMessage (sender, buffer, skipAuth) {
    const y = this.y
    const userID = y.userID
    skipAuth = skipAuth || false
    if (!(buffer instanceof ArrayBuffer || buffer instanceof Uint8Array)) {
      return Promise.reject(new Error('Expected Message to be an ArrayBuffer or Uint8Array!'))
    }
    if (sender === userID) {
      return Promise.resolve()
    }
    let decoder = new BinaryDecoder(buffer)
    let encoder = new BinaryEncoder()
    let roomname = decoder.readVarString() // read room name
    encoder.writeVarString(roomname)
    let messageType = decoder.readVarString()
    let senderConn = this.connections.get(sender)
    this.log('User%s from User%s: Receive \'%s\'', userID, sender, messageType)
    this.logMessage('User%s from User%s: Receive %Y', userID, sender, [y, buffer])
    if (senderConn == null && !skipAuth) {
      throw new Error('Received message from unknown peer!')
    }
    if (messageType === 'sync step 1' || messageType === 'sync step 2') {
      let auth = decoder.readVarUint()
      if (senderConn.auth == null) {
        senderConn.processAfterAuth.push([messageType, senderConn, decoder, encoder, sender])
        // check auth
        return this.checkAuth(auth, y, sender).then(authPermissions => {
          if (senderConn.auth == null) {
            senderConn.auth = authPermissions
            y.emit('userAuthenticated', {
              user: senderConn.uid,
              auth: authPermissions
            })
          }
          let messages = senderConn.processAfterAuth
          senderConn.processAfterAuth = []

          messages.forEach(m =>
            this.computeMessage(m[0], m[1], m[2], m[3], m[4])
          )
        })
      }
    }
    if ((skipAuth || senderConn.auth != null) && (messageType !== 'update' || senderConn.isSynced)) {
      this.computeMessage(messageType, senderConn, decoder, encoder, sender, skipAuth)
    } else {
      senderConn.processAfterSync.push([messageType, senderConn, decoder, encoder, sender, false])
    }
  }

  computeMessage (messageType, senderConn, decoder, encoder, sender, skipAuth) {
    if (messageType === 'sync step 1' && (senderConn.auth === 'write' || senderConn.auth === 'read')) {
      // cannot wait for sync step 1 to finish, because we may wait for sync step 2 in sync step 1 (->lock)
      readSyncStep1(decoder, encoder, this.y, senderConn, sender)
    } else {
      const y = this.y
      y.transact(function () {
        if (messageType === 'sync step 2' && senderConn.auth === 'write') {
          readSyncStep2(decoder, encoder, y, senderConn, sender)
        } else if (messageType === 'update' && (skipAuth || senderConn.auth === 'write')) {
          integrateRemoteStructs(y, decoder)
        } else {
          throw new Error('Unable to receive message')
        }
      }, true)
    }
  }

  _setSyncedWith (user) {
    if (user != null) {
      const userConn = this.connections.get(user)
      userConn.isSynced = true
      const messages = userConn.processAfterSync
      userConn.processAfterSync = []
      messages.forEach(m => {
        this.computeMessage(m[0], m[1], m[2], m[3], m[4])
      })
    }
    const conns = Array.from(this.connections.values())
    if (conns.length > 0 && conns.every(u => u.isSynced)) {
      this._fireIsSyncedListeners()
    }
  }
}
