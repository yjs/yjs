import * as Y from '../index.js'
import { WebsocketProvider } from '../provider/websocket.js'
import { CodeMirrorBinding } from '../bindings/codemirror.js'

import * as conf from './exampleConfig.js'

import CodeMirror from 'codemirror'
import 'codemirror/mode/javascript/javascript.js'

const provider = new WebsocketProvider(conf.serverAddress)
const ydocument = provider.get('codemirror')
const ytext = ydocument.define('codemirror', Y.Text)

const editor = new CodeMirror(document.querySelector('#container'), {
  mode: 'javascript',
  lineNumbers: true
})

const binding = new CodeMirrorBinding(ytext, editor)

window.codemirrorExample = {
  binding, editor, ytext, ydocument
}
