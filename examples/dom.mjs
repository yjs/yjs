import * as Y from '../index.mjs'
import { WebsocketProvider } from '../provider/websocket.mjs'
import { DomBinding } from '../bindings/dom.mjs'

const provider = new WebsocketProvider('wss://api.yjs.website')
const ydocument = provider.get('dom')
const type = ydocument.define('xml', Y.XmlFragment)
const binding = new DomBinding(type, document.querySelector('#content'), { scrollingElement: document.scrollingElement })

window.example = {
  provider, ydocument, type, binding
}
