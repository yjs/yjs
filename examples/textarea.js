import * as Y from '../index.js'
import { WebsocketProvider } from '../provider/websocket.js'
import { TextareaBinding } from '../bindings/textarea.js'

const provider = new WebsocketProvider('wss://api.yjs.website')
const ydocument = provider.get('textarea')
const type = ydocument.define('textarea', Y.Text)
const textarea = document.querySelector('textarea')
const binding = new TextareaBinding(type, textarea)

window.textareaExample = {
  provider, ydocument, type, textarea, binding
}
