import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { CodeMirrorBinding } from 'y-codemirror'

import * as conf from './exampleConfig.js'

import CodeMirror from 'codemirror'
import 'codemirror/mode/javascript/javascript.js'

const provider = new WebsocketProvider(conf.serverAddress)
const ydocument = provider.get('codemirror')
const ytext = ydocument.getText('codemirror')

const editor = new CodeMirror(document.querySelector('#container'), {
  mode: 'javascript',
  lineNumbers: true
})

const binding = new CodeMirrorBinding(ytext, editor)

window.codemirrorExample = {
  binding, editor, ytext, ydocument
}
