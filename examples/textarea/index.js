/* eslint-env browser */
import * as Y from '../../src/index.js'
import WebsocketProvider from '../../provider/websocket/WebSocketProvider.js'

const provider = new WebsocketProvider('ws://localhost:1234/')
const ydocument = provider.get('textarea')
const type = ydocument.define('textarea', Y.Text)
const textarea = document.querySelector('textarea')
const binding = new Y.TextareaBinding(type, textarea)

window.textareaExample = {
  provider, ydocument, type, textarea, binding
}
