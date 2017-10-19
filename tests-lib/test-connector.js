/* global Y */
import { wait } from './helper'
import { messageToString, messageToRoomname } from '../src/MessageHandler/messageToString'

var rooms = {}

export class TestRoom {
  constructor (roomname) {
    this.room = roomname
    this.users = new Map()
  }
  join (connector) {
    const userID = connector.y.userID
    this.users.set(userID, connector)
    for (let [uid, user] of this.users) {
      if (uid !== userID && (user.role === 'master' || connector.role === 'master')) {
        connector.userJoined(uid, this.users.get(uid).role)
        this.users.get(uid).userJoined(userID, connector.role)
      }
    }
  }
  leave (connector) {
    this.users.delete(connector.y.userID)
    this.users.forEach(user => {
      user.userLeft(connector.y.userID)
    })
  }
  send (sender, receiver, m) {
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
    logBufferParsed () {
      console.log(' === Logging buffer of user ' + this.y.userID + ' === ')
      for (let [user, conn] of this.connections) {
        console.log(` ${user}:`)
        for (let i = 0; i < conn.buffer.length; i++) {
          console.log(formatYjsMessage(conn.buffer[i]))
        }
      }
    }
    reconnect () {
      this.testRoom.join(this)
      return super.reconnect()
    }
    send (uid, message) {
      super.send(uid, message)
      this.testRoom.send(this.y.userID, uid, message)
    }
    broadcast (message) {
      super.broadcast(message)
      this.testRoom.broadcast(this.y.userID, message)
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
      if (this.y.userID !== sender && this.connections.has(sender)) {
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
      if (flushUsers.some(u => u.connector.y.userID === this.y.userID)) {
        // this one needs to sync with every other user
        flushUsers = Array.from(this.connections.keys()).map(uid => this.testRoom.users.get(uid).y)
      }
      for (let i = 0; i < flushUsers.length; i++) {
        let userID = flushUsers[i].connector.y.userID
        if (userID !== this.y.userID && this.connections.has(userID)) {
          let buffer = this.connections.get(userID).buffer
          if (buffer != null) {
            var messages = buffer.splice(0)
            for (let j = 0; j < messages.length; j++) {
              super.receiveMessage(userID, messages[j])
            }
          }
        }
      }
      return 'done'
    }
  }
  // TODO: this should be moved to a separate module (dont work on Y)
  Y.test = TestConnector
}

if (typeof Y !== 'undefined') {
  extendTestConnector(Y)
}
