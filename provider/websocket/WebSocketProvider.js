/* eslint-env browser */

import * as Y from '../../src/index.js'
export * from '../../src/index.js'

const messageSync = 0
const messageAwareness = 1

const reconnectTimeout = 100

const setupWS = (doc, url) => {
  const websocket = new WebSocket(url)
  websocket.binaryType = 'arraybuffer'
  doc.ws = websocket
  websocket.onmessage = event => {
    const decoder = Y.createDecoder(event.data)
    const encoder = Y.createEncoder()
    const messageType = Y.readVarUint(decoder)
    switch (messageType) {
      case messageSync:
        Y.writeVarUint(encoder, messageSync)
        doc.mux(() =>
          Y.readSyncMessage(decoder, encoder, doc)
        )
        break
      case messageAwareness:
        Y.readAwarenessMessage(decoder, doc)
        break
    }
    if (Y.length(encoder) > 1) {
      websocket.send(Y.toBuffer(encoder))
    }
  }
  websocket.onclose = () => {
    doc.ws = null
    doc.wsconnected = false
    doc.emit('status', {
      status: 'connected'
    })
    setTimeout(setupWS, reconnectTimeout, doc, url)
  }
  websocket.onopen = () => {
    doc.wsconnected = true
    doc.emit('status', {
      status: 'disconnected'
    })
    // always send sync step 1 when connected
    const encoder = Y.createEncoder()
    Y.writeVarUint(encoder, messageSync)
    Y.writeSyncStep1(encoder, doc)
    websocket.send(Y.toBuffer(encoder))
    // force send stored awareness info
    doc.setAwarenessField(null, null)
  }
}

const broadcastUpdate = (y, transaction) => {
  if (y.wsconnected && transaction.encodedStructsLen > 0) {
    y.mux(() => {
      const encoder = Y.createEncoder()
      Y.writeVarUint(encoder, messageSync)
      Y.writeUpdate(encoder, transaction.encodedStructsLen, transaction.encodedStructs)
      y.ws.send(Y.toBuffer(encoder))
    })
  }
}

class WebsocketsSharedDocument extends Y.Y {
  constructor (url) {
    super()
    this.wsconnected = false
    this.mux = Y.createMutex()
    this.ws = null
    this._localAwarenessState = {}
    this.awareness = new Map()
    setupWS(this, url)
    this.on('afterTransaction', broadcastUpdate)
  }
  getLocalAwarenessInfo () {
    return this._localAwarenessState
  }
  getAwarenessInfo () {
    return this.awareness
  }
  setAwarenessField (field, value) {
    if (field !== null) {
      this._localAwarenessState[field] = value
    }
    if (this.ws !== null) {
      const encoder = Y.createEncoder()
      Y.writeVarUint(encoder, messageAwareness)
      Y.writeUsersStateChange(encoder, [{ userID: this.userID, state: this._localAwarenessState }])
      this.ws.send(Y.toBuffer(encoder))
    }
  }
}

export default class WebsocketProvider {
  constructor (url) {
    // ensure that url is always ends with /
    while (url[url.length - 1] === '/') {
      url = url.slice(0, url.length - 1)
    }
    this.url = url + '/'
    /**
     * @type {Map<string, WebsocketsSharedDocument>}
     */
    this.docs = new Map()
  }
  /**
   * @param {string} name
   * @return {WebsocketsSharedDocument}
   */
  get (name) {
    let doc = this.docs.get(name)
    if (doc === undefined) {
      doc = new WebsocketsSharedDocument(this.url + name)
    }
    return doc
  }
}
