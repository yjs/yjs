const Y = require('../../build/node/index.js')
const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 1234 })
const docs = new Map()

const afterTransaction = (doc, transaction) => {
  if (transaction.encodedStructsLen > 0) {
    const encoder = Y.createEncoder()
    Y.writeUpdate(encoder, transaction.encodedStructsLen, transaction.encodedStructs)
    const message = Y.toBuffer(encoder)
    doc.conns.forEach(conn => conn.send(message))
  }
}

class WSSharedDoc extends Y.Y {
  constructor () {
    super()
    this.mux = Y.createMutex()
    this.conns = new Set()
    this.on('afterTransaction', afterTransaction)
  }
}

const messageListener = (conn, doc, message) => {
  const encoder = Y.createEncoder()
  const decoder = Y.createDecoder(message)
  Y.readMessage(decoder, encoder, doc)
  if (Y.length(encoder) > 0) {
    conn.send(Y.toBuffer(encoder))
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
  doc.conns.add(conn)
  // listen and reply to events
  conn.on('message', message => messageListener(conn, doc, message))
  conn.on('close', () =>
    doc.conns.delete(conn)
  )
  // send sync step 1
  const encoder = Y.createEncoder()
  Y.writeSyncStep1(encoder, doc)
  conn.send(Y.toBuffer(encoder))
}

wss.on('connection', setupConnection)
