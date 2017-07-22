import { BinaryEncoder, BinaryDecoder } from './Encoding.js'
import { computeMessageSyncStep1, computeMessageSyncStep2, computeMessageUpdate } from './MessageHandler.js'

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
      this.connections.forEach(user => { user.isSynced = false })
      this.isSynced = false
      this.currentSyncTarget = null
      this.findNextSyncTarget()
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
        if (user === this.currentSyncTarget) {
          this.currentSyncTarget = null
          this.findNextSyncTarget()
        }
        for (var f of this.userEventListeners) {
          f({
            action: 'userLeft',
            user: user
          })
        }
      }
    }
    userJoined (user, role) {
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
        processAfterAuth: []
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
      if (this.currentSyncTarget == null) {
        this.findNextSyncTarget()
      }
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
    findNextSyncTarget () {
      if (this.currentSyncTarget != null) {
        return // "The current sync has not finished!"
      }

      var syncUser = null
      for (var [uid, user] of this.connections) {
        if (!user.isSynced) {
          syncUser = uid
          break
        }
      }
      var conn = this
      if (syncUser != null) {
        this.currentSyncTarget = syncUser
        this.y.db.requestTransaction(function * () {
          let encoder = new BinaryEncoder()
          encoder.writeVarString('sync step 1')
          encoder.writeVarString(conn.authInfo || '')
          encoder.writeVarUint(conn.protocolVersion)
          let preferUntransformed = conn.preferUntransformed && this.os.length === 0 // TODO: length may not be defined
          encoder.writeUint8(preferUntransformed ? 1 : 0)
          yield * this.writeStateSet(encoder)
          conn.send(syncUser, encoder.createBuffer())
        })
      } else {
        if (!conn.isSynced) {
          this.y.db.requestTransaction(function * () {
            if (!conn.isSynced) {
              // it is crucial that isSynced is set at the time garbageCollectAfterSync is called
              conn.isSynced = true
              // It is safer to remove this!
              // TODO: remove: yield * this.garbageCollectAfterSync()
              // call whensynced listeners
              for (var f of conn.whenSyncedListeners) {
                f()
              }
              conn.whenSyncedListeners = []
            }
          })
        }
      }
    }
    send (uid, buffer) {
      this.log('%s: Send \'%y\' to %s', this.userId, buffer, uid)
      this.logMessage('Message: %Y', buffer)
    }
    broadcast (buffer) {
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
          encoder.writeVarString('update')
          let ops = self.broadcastOpBuffer
          self.broadcastOpBuffer = []
          let length = ops.length
          encoder.writeUint32(length)
          for (var i = 0; i < length; i++) {
            let op = ops[i]
            Y.Struct[op.struct].binaryEncode(encoder, op)
          }
          self.broadcast(encoder.createBuffer())
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
    async receiveMessage (sender, buffer) {
      if (sender === this.userId) {
        return
      }
      let decoder = new BinaryDecoder(buffer)
      let encoder = new BinaryEncoder()
      let messageType = decoder.readVarString()
      let senderConn = this.connections.get(sender)

      if (senderConn == null) {
        throw new Error('Received message from unknown peer!')
      }

      if (messageType === 'sync step 1' || messageType === 'sync step 2') {
        let auth = decoder.readVarUint()
        if (senderConn.auth == null) {
          // check auth
          let authPermissions = await this.checkAuth(auth, this.y, sender)
          senderConn.auth = authPermissions
          this.y.emit('userAuthenticated', {
            user: senderConn.uid,
            auth: authPermissions
          })
          senderConn.syncStep2.promise.then(() => {
            if (senderConn.processAfterAuth == null) {
              return
            }
            for (let i = 0; i < senderConn.processAfterAuth.length; i++) {
              let m = senderConn.processAfterAuth[i]
              this.receiveMessage(m[0], m[1])
            }
            senderConn.processAfterAuth = null
          })
        }
      }

      if (senderConn.auth == null) {
        senderConn.processAfterAuth.push([sender, buffer])
        return
      }

      this.log('%s: Receive \'%s\' from %s', this.userId, messageType, sender)
      this.logMessage('Message: %Y', buffer)

      if (messageType === 'sync step 1' && (senderConn.auth === 'write' || senderConn.auth === 'read')) {
        // cannot wait for sync step 1 to finish, because we may wait for sync step 2 in sync step 1 (->lock)
        computeMessageSyncStep1(decoder, encoder, this, senderConn, sender)
        return this.y.db.whenTransactionsFinished()
      } else if (messageType === 'sync step 2' && senderConn.auth === 'write') {
        return computeMessageSyncStep2(decoder, encoder, this, senderConn, sender)
      } else if (messageType === 'update' && senderConn.auth === 'write') {
        return computeMessageUpdate(decoder, encoder, this, senderConn, sender)
      } else {
        console.error('Unable to receive message')
      }
    }
    _setSyncedWith (user) {
      var conn = this.connections.get(user)
      if (conn != null) {
        conn.isSynced = true
      }
      if (user === this.currentSyncTarget) {
        this.currentSyncTarget = null
        this.findNextSyncTarget()
      }
    }
    /*
      Currently, the HB encodes operations as JSON. For the moment I want to keep it
      that way. Maybe we support encoding in the HB as XML in the future, but for now I don't want
      too much overhead. Y is very likely to get changed a lot in the future

      Because we don't want to encode JSON as string (with character escaping, wich makes it pretty much unreadable)
      we encode the JSON as XML.

      When the HB support encoding as XML, the format should look pretty much like this.

      does not support primitive values as array elements
      expects an ltx (less than xml) object
    */
    parseMessageFromXml (m/* :any */) {
      function parseArray (node) {
        for (var n of node.children) {
          if (n.getAttribute('isArray') === 'true') {
            return parseArray(n)
          } else {
            return parseObject(n)
          }
        }
      }
      function parseObject (node/* :any */) {
        var json = {}
        for (var attrName in node.attrs) {
          var value = node.attrs[attrName]
          var int = parseInt(value, 10)
          if (isNaN(int) || ('' + int) !== value) {
            json[attrName] = value
          } else {
            json[attrName] = int
          }
        }
        for (var n/* :any */ in node.children) {
          var name = n.name
          if (n.getAttribute('isArray') === 'true') {
            json[name] = parseArray(n)
          } else {
            json[name] = parseObject(n)
          }
        }
        return json
      }
      parseObject(m)
    }
    /*
      encode message in xml
      we use string because Strophe only accepts an "xml-string"..
      So {a:4,b:{c:5}} will look like
      <y a="4">
        <b c="5"></b>
      </y>
      m - ltx element
      json - Object
    */
    encodeMessageToXml (msg, obj) {
      // attributes is optional
      function encodeObject (m, json) {
        for (var name in json) {
          var value = json[name]
          if (name == null) {
            // nop
          } else if (value.constructor === Object) {
            encodeObject(m.c(name), value)
          } else if (value.constructor === Array) {
            encodeArray(m.c(name), value)
          } else {
            m.setAttribute(name, value)
          }
        }
      }
      function encodeArray (m, array) {
        m.setAttribute('isArray', 'true')
        for (var e of array) {
          if (e.constructor === Object) {
            encodeObject(m.c('array-element'), e)
          } else {
            encodeArray(m.c('array-element'), e)
          }
        }
      }
      if (obj.constructor === Object) {
        encodeObject(msg.c('y', { xmlns: 'http://y.ninja/connector-stanza' }), obj)
      } else if (obj.constructor === Array) {
        encodeArray(msg.c('y', { xmlns: 'http://y.ninja/connector-stanza' }), obj)
      } else {
        throw new Error("I can't encode this json!")
      }
    }
  }
  Y.AbstractConnector = AbstractConnector
}
