import { WebsocketProvider } from 'y-websocket'
import { TextareaBinding } from 'y-textarea'

import * as conf from './exampleConfig.js'

const provider = new WebsocketProvider(conf.serverAddress)
const ydocument = provider.get('textarea')
const type = ydocument.getText('textarea')
const textarea = document.querySelector('textarea')
const binding = new TextareaBinding(type, textarea)

window.textareaExample = {
  provider, ydocument, type, textarea, binding
}
