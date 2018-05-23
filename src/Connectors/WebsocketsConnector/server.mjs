import Y from '../../Y.mjs'
import uws from 'uws'
import BinaryEncoder from '../../Util/Binary/Encoder.mjs'
import decodeMessage, { messageStructs } from './decodeMessage.mjs'

const WebsocketsServer = uws.Server

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
const wss = new WebsocketsServer({ port: 1234 })

/**
 * Set of room names that are scheduled to be sweeped (destroyed because they don't have a connection anymore)
 */
const scheduledSweeps = new Set()
setInterval(function sweepRoomes () {
  scheduledSweeps.forEach(roomName => {
    const room = rooms.get(roomName)
    if (room !== undefined) {
      if (room.connections.size === 0) {
        room.y.destroy()
      }
      rooms.delete(roomName)
    }
  })
}, 5000)

const wsConnector = {
  _mutualExclude: f => { f() },
  subscribe: function subscribe (roomName, ws) {
    let roomNames = connections.get(ws)
    if (roomNames === undefined) {
      roomNames = new Set()
      connections.set(ws, roomNames)
    }
    roomNames.add(roomName)
  },
  getRoom: function getRoom (roomName) {
    let room = rooms.get(roomName)
    if (room === undefined) {
      const y = new Y(roomName)
      y.on('afterTransaction', (y, transaction) => {
        if (transaction.encodedStructsLen > 0) {
          const encoder = new BinaryEncoder()
          messageStructs(roomName, y, encoder, transaction.encodedStructs)
          const message = encoder.createBuffer()
          // when changed, broakcast update to all connections
          room.connections.forEach(conn => {
            conn.send(message)
          })
        }
      })
      room = {
        name: roomName,
        connections: new Set(),
        y
      }
      rooms.set(roomName, room)
    }
    return room
  }
}

wss.on('connection', (ws) => {
  ws.on('message', function onWSMessage (message) {
    if (message.byteLength > 0) {
      const reply = decodeMessage(wsConnector, message, ws)
      if (reply.length > 0) {
        ws.send(reply.createBuffer())
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
