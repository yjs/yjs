/*
Unlike stated in the LICENSE file, it is not necessary to include the copyright notice and permission notice when you copy code from this file.
*/

/**
 * @module provider/websocket
 */

/* eslint-env browser */

import * as Y from '../../index.js'
import * as bc from '../../lib/broadcastchannel.js'

const messageSync = 0
const messageAwareness = 1
const messageAuth = 2

const reconnectTimeout = 3000

/**
 * @param {WebsocketsSharedDocument} doc
 * @param {string} reason
 */
const permissionDeniedHandler = (doc, reason) => console.warn(`Permission denied to access ${doc.url}.\n${reason}`)

/**
 * @param {WebsocketsSharedDocument} doc
 * @param {ArrayBuffer} buf
 * @return {Y.encoding.Encoder}
 */
const readMessage = (doc, buf) => {
  const decoder = Y.decoding.createDecoder(buf)
  const encoder = Y.encoding.createEncoder()
  const messageType = Y.decoding.readVarUint(decoder)
  switch (messageType) {
    case messageSync:
      Y.encoding.writeVarUint(encoder, messageSync)
      doc.mux(() =>
        Y.syncProtocol.readSyncMessage(decoder, encoder, doc)
      )
      break
    case messageAwareness:
      Y.awarenessProtocol.readAwarenessMessage(decoder, doc)
      break
    case messageAuth:
      Y.authProtocol.readAuthMessage(decoder, doc, permissionDeniedHandler)
  }
  return encoder
}

const setupWS = (doc, url) => {
  const websocket = new WebSocket(url)
  websocket.binaryType = 'arraybuffer'
  doc.ws = websocket
  websocket.onmessage = event => {
    const encoder = readMessage(doc, event.data)
    if (Y.encoding.length(encoder) > 1) {
      websocket.send(Y.encoding.toBuffer(encoder))
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
    const encoder = Y.encoding.createEncoder()
    Y.encoding.writeVarUint(encoder, messageSync)
    Y.syncProtocol.writeSyncStep1(encoder, doc)
    websocket.send(Y.encoding.toBuffer(encoder))
    // force send stored awareness info
    doc.setAwarenessField(null, null)
  }
}

const broadcastUpdate = (y, transaction) => {
  if (transaction.encodedStructsLen > 0) {
    y.mux(() => {
      const encoder = Y.encoding.createEncoder()
      Y.encoding.writeVarUint(encoder, messageSync)
      Y.syncProtocol.writeUpdate(encoder, transaction.encodedStructsLen, transaction.encodedStructs)
      const buf = Y.encoding.toBuffer(encoder)
      if (y.wsconnected) {
        y.ws.send(buf)
      }
      bc.publish(y.url, buf)
    })
  }
}

class WebsocketsSharedDocument extends Y.Y {
  constructor (url) {
    super()
    this.url = url
    this.wsconnected = false
    this.mux = Y.createMutex()
    this.ws = null
    this._localAwarenessState = {}
    this.awareness = new Map()
    this.awarenessClock = new Map()
    setupWS(this, url)
    this.on('afterTransaction', broadcastUpdate)
    this._bcSubscriber = data => {
      const encoder = readMessage(this, data) // already muxed
      this.mux(() => {
        if (Y.encoding.length(encoder) > 1) {
            bc.publish(url, Y.encoding.toBuffer(encoder))
        }
      })
    }
    bc.subscribe(url, this._bcSubscriber)
    // send sync step1 to bc
    this.mux(() => {
      const encoder = Y.encoding.createEncoder()
      Y.encoding.writeVarUint(encoder, messageSync)
      Y.syncProtocol.writeSyncStep1(encoder, this)
      bc.publish(url, Y.encoding.toBuffer(encoder))
    })
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
    if (this.wsconnected) {
      const clock = (this.awarenessClock.get(this.userID) || 0) + 1
      this.awarenessClock.set(this.userID, clock)
      const encoder = Y.encoding.createEncoder()
      Y.encoding.writeVarUint(encoder, messageAwareness)
      Y.awarenessProtocol.writeUsersStateChange(encoder, [{ userID: this.userID, state: this._localAwarenessState, clock }])
      const buf = Y.encoding.toBuffer(encoder)
      this.ws.send(buf)
    }
  }
}

/**
 * Websocket Provider for Yjs. Creates a single websocket connection to each document.
 * The document name is attached to the provided url. I.e. the following example
 * creates a websocket connection to http://localhost:1234/my-document-name
 *
 * @example
 *   import { WebsocketProvider } from 'yjs/provider/websocket/client.js'
 *   const provider = new WebsocketProvider('http://localhost:1234')
 *   const ydocument = provider.get('my-document-name')
 */
export class WebsocketProvider {
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
