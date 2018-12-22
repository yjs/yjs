/*
Unlike stated in the LICENSE file, it is not necessary to include the copyright notice and permission notice when you copy code from this file.
*/

/**
 * @module provider/websocket/server
 */

const Y = require('../../build/yjs.js')
const WebSocket = require('ws')
const http = require('http')

const port = process.env.PORT || 1234

const persistenceDir = process.env.YPERSISTENCE
let persistence = null
if (typeof persistenceDir === 'string') {
  const LevelDbPersistence = require('../../persistence/leveldb.js').LevelDbPersistence
  persistence = new LevelDbPersistence(persistenceDir)
}

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' })
  res.end('okay')
})

const wss = new WebSocket.Server({ noServer: true })

const docs = new Map()

const messageSync = 0
const messageAwareness = 1
const messageAuth = 2

const afterTransaction = (doc, transaction) => {
  if (transaction.encodedStructsLen > 0) {
    const encoder = Y.encoding.createEncoder()
    Y.encoding.writeVarUint(encoder, messageSync)
    Y.syncProtocol.writeUpdate(encoder, transaction.encodedStructsLen, transaction.encodedStructs)
    const message = Y.encoding.toBuffer(encoder)
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
    this.awarenessClock = new Map()
    this.on('afterTransaction', afterTransaction)
  }
}

const messageListener = (conn, doc, message) => {
  const encoder = Y.encoding.createEncoder()
  const decoder = Y.decoding.createDecoder(message)
  const messageType = Y.decoding.readVarUint(decoder)
  switch (messageType) {
    case messageSync:
      Y.encoding.writeVarUint(encoder, messageSync)
      Y.syncProtocol.readSyncMessage(decoder, encoder, doc)
      if (Y.encoding.length(encoder) > 1) {
        conn.send(Y.encoding.toBuffer(encoder))
      }
      break
    case messageAwareness: {
      Y.encoding.writeVarUint(encoder, messageAwareness)
      const updates = Y.awarenessProtocol.forwardAwarenessMessage(decoder, encoder)
      updates.forEach(update => {
        doc.awareness.set(update.userID, update.state)
        doc.awarenessClock.set(update.userID, update.clock)
        doc.conns.get(conn).add(update.userID)
      })
      const buff = Y.encoding.toBuffer(encoder)
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
  const docName = req.url.slice(1)
  let doc = docs.get(docName)
  if (doc === undefined) {
    doc = new WSSharedDoc()
    if (persistence !== null) {
      persistence.bindState(docName, doc)
    }
    docs.set(docName, doc)
  }
  doc.conns.set(conn, new Set())
  // listen and reply to events
  conn.on('message', message => messageListener(conn, doc, message))
  conn.on('close', () => {
    const controlledIds = doc.conns.get(conn)
    doc.conns.delete(conn)
    const encoder = Y.encoding.createEncoder()
    Y.encoding.writeVarUint(encoder, messageAwareness)
    Y.awarenessProtocol.writeUsersStateChange(encoder, Array.from(controlledIds).map(userID => {
      const clock = (doc.awarenessClock.get(userID) || 0) + 1
      doc.awareness.delete(userID)
      doc.awarenessClock.delete(userID)
      return { userID, state: null, clock }
    }))
    const buf = Y.encoding.toBuffer(encoder)
    doc.conns.forEach((_, conn) => conn.send(buf))
    if (doc.conns.size === 0 && persistence !== null) {
      // if persisted, we store state and destroy ydocument
      persistence.writeState(docName, doc).then(() => {
        doc.destroy()
      })
      docs.delete(docName)
    }
  })
  // send sync step 1
  const encoder = Y.encoding.createEncoder()
  Y.encoding.writeVarUint(encoder, messageSync)
  Y.syncProtocol.writeSyncStep1(encoder, doc)
  conn.send(Y.encoding.toBuffer(encoder))
  if (doc.awareness.size > 0) {
    const encoder = Y.encoding.createEncoder()
    const userStates = []
    doc.awareness.forEach((state, userID) => {
      userStates.push({ state, userID, clock: (doc.awarenessClock.get(userID) || 0) })
    })
    Y.encoding.writeVarUint(encoder, messageAwareness)
    Y.awarenessProtocol.writeUsersStateChange(encoder, userStates)
    conn.send(Y.encoding.toBuffer(encoder))
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