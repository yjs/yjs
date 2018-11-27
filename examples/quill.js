import * as Y from '../index.js'
import { WebsocketProvider } from '../provider/websocket.js'
import { QuillBinding } from '../bindings/quill.js'

import * as conf from './exampleConfig.js'

import Quill from 'quill'

const provider = new WebsocketProvider(conf.serverAddress)
const ydocument = provider.get('quill')
const ytext = ydocument.define('quill', Y.Text)

const quill = new Quill('#quill-container', {
  modules: {
    toolbar: [
      [{ header: [1, 2, false] }],
      ['bold', 'italic', 'underline'],
      ['image', 'code-block'],
      [{ color: [] }, { background: [] }], // Snow theme fills in values
      [{ script: 'sub' }, { script: 'super' }],
      ['link', 'image'],
      ['link', 'code-block'],
      [{ list: 'ordered' }, { list: 'bullet' }]
    ]
  },
  placeholder: 'Compose an epic...',
  theme: 'snow' // or 'bubble'
})

window.quillBinding = new QuillBinding(ytext, quill)
