/* @flow */
'use strict'

module.exports = function (Y/* :any */) {
  class AbstractConnector {
    /* ::
    y: YConfig;
    role: SyncRole;
    connections: Object;
    isSynced: boolean;
    userEventListeners: Array<Function>;
    whenSyncedListeners: Array<Function>;
    currentSyncTarget: ?UserId;
    syncingClients: Array<UserId>;
    forwardToSyncingClients: boolean;
    debug: boolean;
    broadcastedHB: boolean;
    syncStep2: Promise;
    userId: UserId;
    send: Function;
    broadcast: Function;
    */
    /*
      opts contains the following information:
       role : String Role of this client ("master" or "slave")
       userId : String Uniquely defines the user.
       debug: Boolean Whether to print debug messages (optional)
    */
    constructor (y, opts) {
      this.y = y
      if (opts == null) {
        opts = {}
      }
      if (opts.role == null || opts.role === 'master') {
        this.role = 'master'
      } else if (opts.role === 'slave') {
        this.role = 'slave'
      } else {
        throw new Error("Role must be either 'master' or 'slave'!")
      }
      this.y.db.forwardAppliedOperations = opts.forwardAppliedOperations || false
      this.role = opts.role
      this.connections = {}
      this.isSynced = false
      this.userEventListeners = []
      this.whenSyncedListeners = []
      this.currentSyncTarget = null
      this.syncingClients = []
      this.forwardToSyncingClients = opts.forwardToSyncingClients !== false
      this.debug = opts.debug === true
      this.broadcastedHB = false
      this.syncStep2 = Promise.resolve()
      this.broadcastOpBuffer = []
    }
    reconnect () {
    }
    disconnect () {
      this.connections = {}
      this.isSynced = false
      this.currentSyncTarget = null
      this.broadcastedHB = false
      this.syncingClients = []
      this.whenSyncedListeners = []
      return this.y.db.stopGarbageCollector()
    }
    setUserId (userId) {
      if (this.userId == null) {
        this.userId = userId
        return this.y.db.setUserId(userId)
      } else {
        return null
      }
    }
    onUserEvent (f) {
      this.userEventListeners.push(f)
    }
    userLeft (user) {
      if (this.connections[user] != null) {
        delete this.connections[user]
        if (user === this.currentSyncTarget) {
          this.currentSyncTarget = null
          this.findNextSyncTarget()
        }
        this.syncingClients = this.syncingClients.filter(function (cli) {
          return cli !== user
        })
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
      if (this.connections[user] != null) {
        throw new Error('This user already joined!')
      }
      this.connections[user] = {
        isSynced: false,
        role: role
      }
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
    /*

     returns false, if there is no sync target
     true otherwise
    */
    findNextSyncTarget () {
      if (this.currentSyncTarget != null || this.isSynced) {
        return // "The current sync has not finished!"
      }

      var syncUser = null
      for (var uid in this.connections) {
        if (!this.connections[uid].isSynced) {
          syncUser = uid
          break
        }
      }
      if (syncUser != null) {
        var conn = this
        this.currentSyncTarget = syncUser
        this.y.db.requestTransaction(function *() {
          var stateSet = yield* this.getStateSet()
          var deleteSet = yield* this.getDeleteSet()
          conn.send(syncUser, {
            type: 'sync step 1',
            stateSet: stateSet,
            deleteSet: deleteSet
          })
        })
      } else {
        this.isSynced = true
        // call when synced listeners
        for (var f of this.whenSyncedListeners) {
          f()
        }
        this.whenSyncedListeners = []
        this.y.db.requestTransaction(function *() {
          yield* this.garbageCollectAfterSync()
        })
      }
    }
    send (uid, message) {
      if (this.debug) {
        console.log(`send ${this.userId} -> ${uid}: ${message.type}`, message) // eslint-disable-line
      }
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
          self.broadcast({
            type: 'update',
            ops: self.broadcastOpBuffer
          })
          self.broadcastOpBuffer = []
        }
      }
      if (this.broadcastOpBuffer.length === 0) {
        this.broadcastOpBuffer = ops
        if (this.y.db.transactionInProgress) {
          this.y.db.whenTransactionsFinished().then(broadcastOperations)
        } else {
          setTimeout(broadcastOperations, 0)
        }
      } else {
        this.broadcastOpBuffer = this.broadcastOpBuffer.concat(ops)
      }
    }
    /*
      You received a raw message, and you know that it is intended for Yjs. Then call this function.
    */
    receiveMessage (sender/* :UserId */, message/* :Message */) {
      if (sender === this.userId) {
        return
      }
      if (this.debug) {
        console.log(`receive ${sender} -> ${this.userId}: ${message.type}`, JSON.parse(JSON.stringify(message))) // eslint-disable-line
      }
      if (message.type === 'sync step 1') {
        // TODO: make transaction, stream the ops
        let conn = this
        let m = message
        this.y.db.requestTransaction(function *() {
          var currentStateSet = yield* this.getStateSet()
          yield* this.applyDeleteSet(m.deleteSet)

          var ds = yield* this.getDeleteSet()
          var ops = yield* this.getOperations(m.stateSet)
          conn.send(sender, {
            type: 'sync step 2',
            os: ops,
            stateSet: currentStateSet,
            deleteSet: ds
          })
          if (this.forwardToSyncingClients) {
            conn.syncingClients.push(sender)
            setTimeout(function () {
              conn.syncingClients = conn.syncingClients.filter(function (cli) {
                return cli !== sender
              })
              conn.send(sender, {
                type: 'sync done'
              })
            }, 5000) // TODO: conn.syncingClientDuration)
          } else {
            conn.send(sender, {
              type: 'sync done'
            })
          }
          conn._setSyncedWith(sender)
        })
      } else if (message.type === 'sync step 2') {
        let conn = this
        var broadcastHB = !this.broadcastedHB
        this.broadcastedHB = true
        var db = this.y.db
        var defer = {}
        defer.promise = new Promise(function (resolve) {
          defer.resolve = resolve
        })
        this.syncStep2 = defer.promise
        let m /* :MessageSyncStep2 */ = message
        db.requestTransaction(function * () {
          yield* this.applyDeleteSet(m.deleteSet)
          this.store.apply(m.os)
          db.requestTransaction(function * () {
            var ops = yield* this.getOperations(m.stateSet)
            if (ops.length > 0) {
              if (!broadcastHB) { // TODO: consider to broadcast here..
                conn.send(sender, {
                  type: 'update',
                  ops: ops
                })
              } else {
                // broadcast only once!
                conn.broadcastOps(ops)
              }
            }
            defer.resolve()
          })
        })
      } else if (message.type === 'sync done') {
        var self = this
        this.syncStep2.then(function () {
          self._setSyncedWith(sender)
        })
      } else if (message.type === 'update') {
        if (this.forwardToSyncingClients) {
          for (var client of this.syncingClients) {
            this.send(client, message)
          }
        }
        if (this.y.db.forwardAppliedOperations) {
          var delops = message.ops.filter(function (o) {
            return o.struct === 'Delete'
          })
          if (delops.length > 0) {
            this.broadcastOps(delops)
          }
        }
        this.y.db.apply(message.ops)
      }
    }
    _setSyncedWith (user) {
      var conn = this.connections[user]
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
