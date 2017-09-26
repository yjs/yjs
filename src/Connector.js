import { BinaryEncoder, BinaryDecoder } from './Encoding.js'
import { sendSyncStep1, computeMessageSyncStep1, computeMessageSyncStep2, computeMessageUpdate } from './MessageHandler.js'

export default function extendConnector (Y/* :any */) {
  class AbstractConnector {
    /*
      opts contains the following information:
       role : String Role of this client ("master" or "slave")
    */
    constructor (y, opts) {
      this.y = y
      if (opts == null) {
        opts = {}
      }
      this.opts = opts
      // Prefer to receive untransformed operations. This does only work if
      // this client receives operations from only one other client.
      // In particular, this does not work with y-webrtc.
      // It will work with y-websockets-client
      this.preferUntransformed = opts.preferUntransformed || false
      if (opts.role == null || opts.role === 'master') {
        this.role = 'master'
      } else if (opts.role === 'slave') {
        this.role = 'slave'
      } else {
        throw new Error("Role must be either 'master' or 'slave'!")
      }
      this.log = Y.debug('y:connector')
      this.logMessage = Y.debug('y:connector-message')
      this.y.db.forwardAppliedOperations = opts.forwardAppliedOperations || false
      this.role = opts.role
      this.connections = new Map()
      this.isSynced = false
      this.userEventListeners = []
      this.whenSyncedListeners = []
      this.currentSyncTarget = null
      this.debug = opts.debug === true
      this.broadcastOpBuffer = []
      this.protocolVersion = 11
      this.authInfo = opts.auth || null
      this.checkAuth = opts.checkAuth || function () { return Promise.resolve('write') } // default is everyone has write access
      if (opts.generateUserId !== false) {
        this.setUserId(Y.utils.generateUserId())
      }
      if (opts.maxBufferLength == null) {
        this.maxBufferLength = -1
      } else {
        this.maxBufferLength = opts.maxBufferLength
      }
    }

    reconnect () {
      this.log('reconnecting..')
      return this.y.db.startGarbageCollector()
    }

    disconnect () {
      this.log('discronnecting..')
      this.connections = new Map()
      this.isSynced = false
      this.currentSyncTarget = null
      this.whenSyncedListeners = []
      this.y.db.stopGarbageCollector()
      return this.y.db.whenTransactionsFinished()
    }

    repair () {
      this.log('Repairing the state of Yjs. This can happen if messages get lost, and Yjs detects that something is wrong. If this happens often, please report an issue here: https://github.com/y-js/yjs/issues')
      this.isSynced = false
      this.connections.forEach((user, userId) => {
        user.isSynced = false
        this._syncWithUser(userId)
      })
    }

    setUserId (userId) {
      if (this.userId == null) {
        if (!Number.isInteger(userId)) {
          let err = new Error('UserId must be an integer!')
          this.y.emit('error', err)
          throw err
        }
        this.log('Set userId to "%s"', userId)
        this.userId = userId
        return this.y.db.setUserId(userId)
      } else {
        return null
      }
    }

    onUserEvent (f) {
      this.userEventListeners.push(f)
    }

    removeUserEventListener (f) {
      this.userEventListeners = this.userEventListeners.filter(g => f !== g)
    }

    userLeft (user) {
      if (this.connections.has(user)) {
        this.log('%s: User left %s', this.userId, user)
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
      this.log('%s: User joined %s', this.userId, user)
      this.connections.set(user, {
        uid: user,
        isSynced: false,
        role: role,
        processAfterAuth: [],
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

    _syncWithUser (userid) {
      if (this.role === 'slave') {
        return // "The current sync has not finished or this is controlled by a master!"
      }
      sendSyncStep1(this, userid)
    }

    _fireIsSyncedListeners () {
      this.y.db.whenTransactionsFinished().then(() => {
        if (!this.isSynced) {
          this.isSynced = true
          // It is safer to remove this!
          // TODO: remove: this.garbageCollectAfterSync()
          // call whensynced listeners
          for (var f of this.whenSyncedListeners) {
            f()
          }
          this.whenSyncedListeners = []
        }
      })
    }

    send (uid, buffer) {
      if (!(buffer instanceof ArrayBuffer || buffer instanceof Uint8Array)) {
        throw new Error('Expected Message to be an ArrayBuffer or Uint8Array - please don\'t use this method to send custom messages')
      }
      this.log('%s: Send \'%y\' to %s', this.userId, buffer, uid)
      this.logMessage('Message: %Y', buffer)
    }

    broadcast (buffer) {
      if (!(buffer instanceof ArrayBuffer || buffer instanceof Uint8Array)) {
        throw new Error('Expected Message to be an ArrayBuffer or Uint8Array - please don\'t use this method to send custom messages')
      }
      this.log('%s: Broadcast \'%y\'', this.userId, buffer)
      this.logMessage('Message: %Y', buffer)
    }

    /*
      Buffer operations, and broadcast them when ready.
    */
    broadcastOps (ops) {
      ops = ops.map(function (op) {
        return Y.Struct[op.struct].encode(op)
      })
      var self = this
      function broadcastOperations () {
        if (self.broadcastOpBuffer.length > 0) {
          let encoder = new BinaryEncoder()
          encoder.writeVarString(self.opts.room)
          encoder.writeVarString('update')
          let ops = self.broadcastOpBuffer
          let length = ops.length
          let encoderPosLen = encoder.pos
          encoder.writeUint32(0)
          for (var i = 0; i < length && (self.maxBufferLength < 0 || encoder.length < self.maxBufferLength); i++) {
            let op = ops[i]
            Y.Struct[op.struct].binaryEncode(encoder, op)
          }
          encoder.setUint32(encoderPosLen, i)
          self.broadcastOpBuffer = ops.slice(i)
          self.broadcast(encoder.createBuffer())
          if (i !== length) {
            setTimeout(broadcastOperations, 100)
          }
        }
      }
      if (this.broadcastOpBuffer.length === 0) {
        this.broadcastOpBuffer = ops
        this.y.db.whenTransactionsFinished().then(broadcastOperations)
      } else {
        this.broadcastOpBuffer = this.broadcastOpBuffer.concat(ops)
      }
    }

    /*
      You received a raw message, and you know that it is intended for Yjs. Then call this function.
    */
    receiveMessage (sender, buffer, skipAuth) {
      skipAuth = skipAuth || false
      if (!(buffer instanceof ArrayBuffer || buffer instanceof Uint8Array)) {
        return Promise.reject(new Error('Expected Message to be an ArrayBuffer or Uint8Array!'))
      }
      if (sender === this.userId) {
        return Promise.resolve()
      }
      let decoder = new BinaryDecoder(buffer)
      let encoder = new BinaryEncoder()
      let roomname = decoder.readVarString() // read room name
      encoder.writeVarString(roomname)
      let messageType = decoder.readVarString()
      let senderConn = this.connections.get(sender)
      this.log('%s: Receive \'%s\' from %s', this.userId, messageType, sender)
      this.logMessage('Message: %Y', buffer)
      if (senderConn == null && !skipAuth) {
        throw new Error('Received message from unknown peer!')
      }
      if (messageType === 'sync step 1' || messageType === 'sync step 2') {
        let auth = decoder.readVarUint()
        if (senderConn.auth == null) {
          senderConn.processAfterAuth.push([messageType, senderConn, decoder, encoder, sender])
          // check auth
          return this.checkAuth(auth, this.y, sender).then(authPermissions => {
            if (senderConn.auth == null) {
              senderConn.auth = authPermissions
              this.y.emit('userAuthenticated', {
                user: senderConn.uid,
                auth: authPermissions
              })
            }
            let messages = senderConn.processAfterAuth
            senderConn.processAfterAuth = []

            return messages.reduce((p, m) =>
              p.then(() => this.computeMessage(m[0], m[1], m[2], m[3], m[4]))
            , Promise.resolve())
          })
        }
      }
      if (skipAuth || senderConn.auth != null) {
        return this.computeMessage(messageType, senderConn, decoder, encoder, sender, skipAuth)
      } else {
        senderConn.processAfterAuth.push([messageType, senderConn, decoder, encoder, sender, false])
      }
    }

    computeMessage (messageType, senderConn, decoder, encoder, sender, skipAuth) {
      if (messageType === 'sync step 1' && (senderConn.auth === 'write' || senderConn.auth === 'read')) {
        // cannot wait for sync step 1 to finish, because we may wait for sync step 2 in sync step 1 (->lock)
        computeMessageSyncStep1(decoder, encoder, this, senderConn, sender)
        return this.y.db.whenTransactionsFinished()
      } else if (messageType === 'sync step 2' && senderConn.auth === 'write') {
        return computeMessageSyncStep2(decoder, encoder, this, senderConn, sender)
      } else if (messageType === 'update' && (skipAuth || senderConn.auth === 'write')) {
        return computeMessageUpdate(decoder, encoder, this, senderConn, sender)
      } else {
        return Promise.reject(new Error('Unable to receive message'))
      }
    }

    _setSyncedWith (user) {
      if (user != null) {
        this.connections.get(user).isSynced = true
      }
      let conns = Array.from(this.connections.values())
      if (conns.length > 0 && conns.every(u => u.isSynced)) {
        this._fireIsSyncedListeners()
      }
    }
  }
  Y.AbstractConnector = AbstractConnector
}
