/* global getRandom, async */
'use strict'

module.exports = function (Y) {
  var globalRoom = {
    users: {},
    buffers: {},
    removeUser: function (user) {
      for (var i in this.users) {
        this.users[i].userLeft(user)
      }
      delete this.users[user]
      delete this.buffers[user]
    },
    addUser: function (connector) {
      this.users[connector.userId] = connector
      this.buffers[connector.userId] = []
      for (var uname in this.users) {
        if (uname !== connector.userId) {
          var u = this.users[uname]
          u.userJoined(connector.userId, 'master')
          connector.userJoined(u.userId, 'master')
        }
      }
    },
    whenTransactionsFinished: function () {
      var ps = []
      for (var name in this.users) {
        ps.push(this.users[name].y.db.whenTransactionsFinished())
      }
      return Promise.all(ps)
    },
    flushOne: function flushOne () {
      var bufs = []
      for (var i in globalRoom.buffers) {
        if (globalRoom.buffers[i].length > 0) {
          bufs.push(i)
        }
      }
      if (bufs.length > 0) {
        var userId = getRandom(bufs)
        var m = globalRoom.buffers[userId].shift()
        var user = globalRoom.users[userId]
        user.receiveMessage(m[0], m[1])
        return user.y.db.whenTransactionsFinished()
      } else {
        return false
      }
    }
  }
  Y.utils.globalRoom = globalRoom

  var userIdCounter = 0

  class Test extends Y.AbstractConnector {
    constructor (y, options) {
      if (options === undefined) {
        throw new Error('Options must not be undefined!')
      }
      options.role = 'master'
      options.forwardToSyncingClients = false
      super(y, options)
      this.setUserId((userIdCounter++) + '').then(() => {
        globalRoom.addUser(this)
      })
      this.globalRoom = globalRoom
      this.syncingClientDuration = 0
    }
    receiveMessage (sender, m) {
      super.receiveMessage(sender, JSON.parse(JSON.stringify(m)))
    }
    send (userId, message) {
      var buffer = globalRoom.buffers[userId]
      if (buffer != null) {
        buffer.push(JSON.parse(JSON.stringify([this.userId, message])))
      }
    }
    broadcast (message) {
      for (var key in globalRoom.buffers) {
        globalRoom.buffers[key].push(JSON.parse(JSON.stringify([this.userId, message])))
      }
    }
    isDisconnected () {
      return globalRoom.users[this.userId] == null
    }
    reconnect () {
      if (this.isDisconnected()) {
        globalRoom.addUser(this)
        super.reconnect()
      }
      return this.flushAll()
    }
    disconnect () {
      if (!this.isDisconnected()) {
        globalRoom.removeUser(this.userId)
        super.disconnect()
      }
      return this.y.db.whenTransactionsFinished()
    }
    flush () {
      var self = this
      return async(function * () {
        while (globalRoom.buffers[self.userId].length > 0) {
          var m = globalRoom.buffers[self.userId].shift()
          this.receiveMessage(m[0], m[1])
        }
        yield self.whenTransactionsFinished()
      })
    }
    flushAll () {
      return new Promise(function (resolve) {
        // flushes may result in more created operations,
        // flush until there is nothing more to flush
        function nextFlush () {
          var c = globalRoom.flushOne()
          if (c) {
            while (globalRoom.flushOne()) {
              // nop
            }
            globalRoom.whenTransactionsFinished().then(nextFlush)
          } else {
            resolve()
          }
        }
        globalRoom.whenTransactionsFinished().then(nextFlush)
      })
    }
  }

  Y.Test = Test
}
