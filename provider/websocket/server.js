/**
 * @module provider/websocket/server
 */

const Y = require('../../build/yjs.js')
const WebSocket = require('ws')
const http = require('http')

const port = process.env.PORT || 1234

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('okay')
})

const wss = new WebSocket.Server({ noServer: true })

const docs = new Map()

const messageSync = 0
const messageAwareness = 1

const afterTransaction = (doc, transaction) => {
  if (transaction.encodedStructsLen > 0) {
    const encoder = Y.createEncoder()
    Y.writeVarUint(encoder, messageSync)
    Y.writeUpdate(encoder, transaction.encodedStructsLen, transaction.encodedStructs)
    const message = Y.toBuffer(encoder)
    doc.conns.forEach((_, conn) => conn.send(message))
  }
}

class WSSharedDoc extends Y.Y {
  constructor () {
    super({ gc: true })
    this.mux = Y.createMutex()
    /**
     * Maps from conn to set of controlled user ids. Delete all user ids from awareness when this conn is closed
     * @type {Map<Object, Set<number>>}
     */
    this.conns = new Map()
    this.awareness = new Map()
    this.on('afterTransaction', afterTransaction)
  }
}

const messageListener = (conn, doc, message) => {
  const encoder = Y.createEncoder()
  const decoder = Y.createDecoder(message)
  const messageType = Y.readVarUint(decoder)
  switch (messageType) {
    case messageSync:
      Y.writeVarUint(encoder, messageSync)
      Y.readSyncMessage(decoder, encoder, doc)
      if (Y.length(encoder) > 1) {
        conn.send(Y.toBuffer(encoder))
      }
      break
    case messageAwareness: {
      Y.writeVarUint(encoder, messageAwareness)
      const updates = Y.forwardAwarenessMessage(decoder, encoder)
      updates.forEach(update => {
        doc.awareness.set(update.userID, update.state)
        doc.conns.get(conn).add(update.userID)
      })
      const buff = Y.toBuffer(encoder)
      doc.conns.forEach((_, c) => {
        c.send(buff)
      })
      break
    }
  }
}

const setupConnection = (conn, req) => {
  conn.binaryType = 'arraybuffer'
  // get doc, create if it does not exist yet
  let doc = docs.get(req.url.slice(1))
  if (doc === undefined) {
    doc = new WSSharedDoc()
    docs.set(req.url.slice(1), doc)
  }
  doc.conns.set(conn, new Set())
  // listen and reply to events
  conn.on('message', message => messageListener(conn, doc, message))
  conn.on('close', () => {
    const controlledIds = doc.conns.get(conn)
    doc.conns.delete(conn)
    const encoder = Y.createEncoder()
    Y.writeVarUint(encoder, messageAwareness)
    Y.writeUsersStateChange(encoder, Array.from(controlledIds).map(userID => {
      doc.awareness.delete(userID)
      return { userID, state: null }
    }))
    const buf = Y.toBuffer(encoder)
    doc.conns.forEach((_, conn) => conn.send(buf))
  })
  // send sync step 1
  const encoder = Y.createEncoder()
  Y.writeVarUint(encoder, messageSync)
  Y.writeSyncStep1(encoder, doc)
  conn.send(Y.toBuffer(encoder))
  if (doc.awareness.size > 0) {
    const encoder = Y.createEncoder()
    const userStates = []
    doc.awareness.forEach((state, userID) => {
      userStates.push({ state, userID })
    })
    Y.writeVarUint(encoder, messageAwareness)
    Y.writeUsersStateChange(encoder, userStates)
    conn.send(Y.toBuffer(encoder))
  }
}

wss.on('connection', setupConnection)

server.on('upgrade', (request, socket, head) => {
  // You may check auth of request here..
  wss.handleUpgrade(request, socket, head, ws => {
    wss.emit('connection', ws, request)
  })
})

server.listen(port)

console.log('running on port', port)
