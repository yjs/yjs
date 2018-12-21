import * as Y from '../index.js'
import { WebsocketProvider } from '../provider/websocket.js'
import { DomBinding } from '../bindings/dom.js'
import * as conf from './exampleConfig.js'

const provider = new WebsocketProvider(conf.serverAddress)
const ydocument = provider.get('dom')
const type = ydocument.define('xml', Y.XmlFragment)
const binding = new DomBinding(type, document.querySelector('#content'), { scrollingElement: document.scrollingElement })

window.example = {
  provider, ydocument, type, binding
}
