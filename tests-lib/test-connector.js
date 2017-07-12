/* global Y */
import { wait } from './helper.js'

var rooms = {}

export class TestRoom {
  constructor (roomname) {
    this.room = roomname
    this.users = new Map()
    this.nextUserId = 0
  }
  join (connector) {
    if (connector.userId == null) {
      connector.setUserId(this.nextUserId++)
    }
    this.users.forEach((user, uid) => {
      if (user.role === 'master' || connector.role === 'master') {
        this.users.get(uid).userJoined(connector.userId, connector.role)
        connector.userJoined(uid, this.users.get(uid).role)
      }
    })
    this.users.set(connector.userId, connector)
  }
  leave (connector) {
    this.users.delete(connector.userId)
    this.users.forEach(user => {
      user.userLeft(connector.userId)
    })
  }
  send (sender, receiver, m) {
    m = JSON.parse(JSON.stringify(m))
    var user = this.users.get(receiver)
    if (user != null) {
      user.receiveMessage(sender, m)
    }
  }
  broadcast (sender, m) {
    this.users.forEach((user, receiver) => {
      this.send(sender, receiver, m)
    })
  }
  async flushAll (users) {
    let flushing = true
    let allUserIds = Array.from(this.users.keys())
    if (users == null) {
      users = allUserIds.map(id => this.users.get(id).y)
    }
    while (flushing) {
      await wait(10)
      let res = await Promise.all(allUserIds.map(id => this.users.get(id)._flushAll(users)))
      flushing = res.some(status => status === 'flushing')
    }
  }
}

function getTestRoom (roomname) {
  if (rooms[roomname] == null) {
    rooms[roomname] = new TestRoom(roomname)
  }
  return rooms[roomname]
}

export default function extendTestConnector (Y) {
  class TestConnector extends Y.AbstractConnector {
    constructor (y, options) {
      if (options === undefined) {
        throw new Error('Options must not be undefined!')
      }
      if (options.room == null) {
        throw new Error('You must define a room name!')
      }
      options.forwardAppliedOperations = options.role === 'master'
      super(y, options)
      this.options = options
      this.room = options.room
      this.chance = options.chance
      this.testRoom = getTestRoom(this.room)
      this.testRoom.join(this)
    }
    disconnect () {
      this.testRoom.leave(this)
      return super.disconnect()
    }
    reconnect () {
      this.testRoom.join(this)
      return super.reconnect()
    }
    send (uid, message) {
      this.testRoom.send(this.userId, uid, message)
    }
    broadcast (message) {
      this.testRoom.broadcast(this.userId, message)
    }
    async whenSynced (f) {
      var synced = false
      var periodicFlushTillSync = () => {
        if (synced) {
          f()
        } else {
          this.testRoom.flushAll([this.y]).then(function () {
            setTimeout(periodicFlushTillSync, 10)
          })
        }
      }
      periodicFlushTillSync()
      return super.whenSynced(function () {
        synced = true
      })
    }
    receiveMessage (sender, m) {
      if (this.userId !== sender && this.connections.has(sender)) {
        var buffer = this.connections.get(sender).buffer
        if (buffer == null) {
          buffer = this.connections.get(sender).buffer = []
        }
        buffer.push(m)
        if (this.chance.bool({likelihood: 30})) {
          // flush 1/2 with 30% chance
          var flushLength = Math.round(buffer.length / 2)
          buffer.splice(0, flushLength).forEach(m => {
            super.receiveMessage(sender, m)
          })
        }
      }
    }
    async _flushAll (flushUsers) {
      if (flushUsers.some(u => u.connector.userId === this.userId)) {
        // this one needs to sync with every other user
        flushUsers = Array.from(this.connections.keys()).map(uid => this.testRoom.users.get(uid).y)
      }
      var finished = []
      for (let i = 0; i < flushUsers.length; i++) {
        let userId = flushUsers[i].connector.userId
        if (userId !== this.userId && this.connections.has(userId)) {
          let buffer = this.connections.get(userId).buffer
          if (buffer != null) {
            var messages = buffer.splice(0)
            for (let j = 0; j < messages.length; j++) {
              let p = super.receiveMessage(userId, messages[j])
              finished.push(p)
            }
          }
        }
      }
      await Promise.all(finished)
      await this.y.db.whenTransactionsFinished()
      return finished.length > 0 ? 'flushing' : 'done'
    }
  }
  Y.extend('test', TestConnector)
}

if (typeof Y !== 'undefined') {
  extendTestConnector(Y)
}
