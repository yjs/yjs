import Y from '../../Y.mjs'
import uws from 'uws'
import BinaryEncoder from '../../Util/Binary/Encoder.mjs'
import decodeMessage, { messageStructs } from './decodeMessage.mjs'
import FilePersistence from '../../Persistences/FilePersistence.mjs'

const WebsocketsServer = uws.Server
const persistence = new FilePersistence('.yjsPersisted')
/**
  * Maps from room-name to ..
  * {
  *   connections, // Set of ws-clients that listen to the room
  *   y            // Yjs instance that handles the room
  * }
  */
const rooms = new Map()
/**
 * Maps from ws-connection to Set<roomName> - the set of connected roomNames
 */
const connections = new Map()
const port = process.env.PORT || 1234
const wss = new WebsocketsServer({
  port,
  perMessageDeflate: {}
})

/**
 * Set of room names that are scheduled to be sweeped (destroyed because they don't have a connection anymore)
 */
const scheduledSweeps = new Set()
setInterval(function sweepRoomes () {
  scheduledSweeps.forEach(roomName => {
    const room = rooms.get(roomName)
    if (room !== undefined) {
      if (room.connections.size === 0) {
        persistence.saveState(roomName, room.y).then(() => {
          if (room.connections.size === 0) {
            room.y.destroy()
            rooms.delete(roomName)
          }
        })
      }
    }
  })
  scheduledSweeps.clear()
}, 5000)

const wsConnector = {
  send: (encoder, ws) => {
    const message = encoder.createBuffer()
    ws.send(message, null, null, true)
  },
  _mutualExclude: f => { f() },
  subscribe: function subscribe (roomName, ws) {
    let roomNames = connections.get(ws)
    if (roomNames === undefined) {
      roomNames = new Set()
      connections.set(ws, roomNames)
    }
    roomNames.add(roomName)
    const room = this.getRoom(roomName)
    room.connections.add(ws)
  },
  getRoom: function getRoom (roomName) {
    let room = rooms.get(roomName)
    if (room === undefined) {
      const y = new Y(roomName, null, null, { gc: true })
      const persistenceLoaded = persistence.readState(roomName, y)
      y.on('afterTransaction', (y, transaction) => {
        if (transaction.encodedStructsLen > 0) {
          // save to persistence
          persistence.saveUpdate(roomName, y, transaction.encodedStructs)
          // forward update to clients
          persistence._mutex(() => { // do not broadcast if persistence.readState is called
            const encoder = new BinaryEncoder()
            messageStructs(roomName, y, encoder, transaction.encodedStructs)
            const message = encoder.createBuffer()
            // when changed, broakcast update to all connections
            room.connections.forEach(conn => {
              conn.send(message, null, null, true)
            })
          })
        }
      })
      room = {
        name: roomName,
        connections: new Set(),
        y,
        persistenceLoaded
      }
      rooms.set(roomName, room)
    }
    return room
  }
}

wss.on('connection', (ws) => {
  ws.on('message', function onWSMessage (message) {
    if (message.byteLength > 0) {
      const reply = decodeMessage(wsConnector, message, ws, true)
      if (reply.length > 0) {
        ws.send(reply.createBuffer(), null, null, true)
      }
    }
  })
  ws.on('close', function onWSClose () {
    const roomNames = connections.get(ws)
    if (roomNames !== undefined) {
      roomNames.forEach(roomName => {
        const room = rooms.get(roomName)
        if (room !== undefined) {
          const connections = room.connections
          connections.delete(ws)
          if (connections.size === 0) {
            scheduledSweeps.add(roomName)
          }
        }
      })
      connections.delete(ws)
    }
  })
})
