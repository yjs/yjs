/* global getRandom, AbstractConnector, Y, wait */
'use strict'

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
  }
}
function flushOne () {
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
    return true
  } else {
    return false
  }
}

// setInterval(flushOne, 10)

var userIdCounter = 0

class Test extends AbstractConnector {
  constructor (y, options) {
    if (options === undefined) {
      throw new Error('Options must not be undefined!')
    }
    options.role = 'master'
    options.forwardToSyncingClients = false
    super(y, options)
    this.setUserId((userIdCounter++) + '')
    globalRoom.addUser(this)
    this.globalRoom = globalRoom
  }
  send (userId, message) {
    globalRoom.buffers[userId].push(JSON.parse(JSON.stringify([this.userId, message])))
  }
  broadcast (message) {
    for (var key in globalRoom.buffers) {
      globalRoom.buffers[key].push(JSON.parse(JSON.stringify([this.userId, message])))
    }
  }
  reconnect () {
    globalRoom.addUser(this)
    super.reconnect()
  }
  disconnect () {
    globalRoom.removeUser(this.userId)
    super.disconnect()
  }
  flush () {
    var buff = globalRoom.buffers[this.userId]
    while (buff.length > 0) {
      var m = buff.shift()
      this.receiveMessage(m[0], m[1])
    }
  }
  flushAll () {
    var def = Promise.defer()
    // flushes may result in more created operations,
    // flush until there is nothing more to flush
    function nextFlush () {
      var c = flushOne()
      if (c) {
        while (flushOne()) {
          // nop
        }
        wait().then(nextFlush)
      } else {
        wait().then(function () {
          def.resolve()
        })
      }
    }
    // in the case that there are
    // still actions that want to be performed
    wait(0).then(nextFlush)
    return def.promise
  }
  flushOne () {
    flushOne()
  }
}

Y.Test = Test
