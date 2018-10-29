/* eslint-env browser */

import * as Y from '../../src/index.js'
export * from '../../src/index.js'

const reconnectTimeout = 100

const setupWS = (doc, url) => {
  const websocket = new WebSocket(url)
  websocket.binaryType = 'arraybuffer'
  doc.ws = websocket
  websocket.onmessage = event => {
    const decoder = Y.createDecoder(event.data)
    const encoder = Y.createEncoder()
    doc.mux(() =>
      Y.readMessage(decoder, encoder, doc)
    )
    if (Y.length(encoder) > 0) {
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
    Y.writeSyncStep1(encoder, doc)
    websocket.send(Y.toBuffer(encoder))
  }
}

const broadcastUpdate = (y, transaction) => {
  if (y.wsconnected && transaction.encodedStructsLen > 0) {
    y.mux(() => {
      const encoder = Y.createEncoder()
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
    setupWS(this, url)
    this.on('afterTransaction', broadcastUpdate)
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
