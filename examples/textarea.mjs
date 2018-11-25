import * as Y from '../index.mjs'
import { WebsocketProvider } from '../provider/websocket.mjs'
import { TextareaBinding } from '../bindings/textarea.mjs'

const provider = new WebsocketProvider('wss://yjs-v13-72-p02p39swv.now.sh')
const ydocument = provider.get('textarea')
const type = ydocument.define('textarea', Y.Text)
const textarea = document.querySelector('textarea')
const binding = new TextareaBinding(type, textarea)

window.textareaExample = {
  provider, ydocument, type, textarea, binding
}
