import * as Y from '../index.js'
import { WebsocketProvider } from '../provider/websocket.js'
import { prosemirrorPlugin, cursorPlugin } from '../bindings/prosemirror.js'

import * as conf from './exampleConfig.js'

import { EditorState } from 'prosemirror-state'
import { EditorView } from 'prosemirror-view'
import { DOMParser, Schema } from 'prosemirror-model'
import { schema } from './prosemirror-schema.js'
import { exampleSetup } from 'prosemirror-example-setup'
import { noteHistoryPlugin } from './prosemirror-history.js'

const provider = new WebsocketProvider(conf.serverAddress)
const ydocument = provider.get('prosemirror', { gc: false })
const type = ydocument.define('prosemirror', Y.XmlFragment)

const prosemirrorView = new EditorView(document.querySelector('#editor'), {
  state: EditorState.create({
    doc: DOMParser.fromSchema(schema).parse(document.querySelector('#content')),
    plugins: exampleSetup({schema}).concat([prosemirrorPlugin(type), cursorPlugin /* noteHistoryPlugin */])
  })
})

window.example = { provider, ydocument, type, prosemirrorView }
