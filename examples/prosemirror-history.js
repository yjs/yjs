
import {Plugin} from "prosemirror-state"
import crel from 'crel'
import * as Y from '../index.js'
import { prosemirrorPluginKey } from '../bindings/prosemirror.js'
import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
import * as historyProtocol from '../protocols/history.js'

export const noteHistoryPlugin = new Plugin({
  view (editorView) { return new NoteHistoryPlugin(editorView) }
})

const createWrapper = () => {
  const wrapper = crel('div', { style: 'display: flex' })
  const historyContainer = crel('div', { style: 'align-self: baseline; flex-basis: 250px;', class: 'shared-history' })
  wrapper.insertBefore(historyContainer, null)
  return { wrapper, historyContainer }
}

class NoteHistoryPlugin {
  constructor(editorView) {
    this.editorView = editorView
    const { historyContainer, wrapper } = createWrapper()
    this.wrapper = wrapper
    this.historyContainer = historyContainer
    const n = editorView.dom.parentNode.parentNode
    n.parentNode.replaceChild(this.wrapper, n)
    n.style['flex-grow'] = '1'
    wrapper.insertBefore(n, this.wrapper.firstChild)
    this.render()
    const y = prosemirrorPluginKey.getState(this.editorView.state).y
    const history = y.define('history', Y.Array)
    history.observe(this.render.bind(this))
  }
  render () {
    const y = prosemirrorPluginKey.getState(this.editorView.state).y
    const history = y.define('history', Y.Array).toArray()
    const fragment = document.createDocumentFragment()
    const snapshotBtn = crel('button', { type: 'button' }, ['snapshot'])
    snapshotBtn.addEventListener('click', this.snapshot.bind(this))
    fragment.insertBefore(snapshotBtn, null)
    history.forEach(buf => {
      const decoder = decoding.createDecoder(buf)
      const snapshot = historyProtocol.readHistorySnapshot(decoder)
      const date = new Date(decoding.readUint32(decoder) * 1000)
      const a = crel('a', [
        '• '+ date.toUTCString()
      ])
      const el = crel('div', [ a ])
      a.addEventListener('click', () => {
        console.log('setting snapshot')
        this.editorView.dispatch(this.editorView.state.tr.setMeta(prosemirrorPluginKey, { snapshot }))
      })
      fragment.insertBefore(el, null)
    })
    this.historyContainer.innerHTML = ''
    this.historyContainer.insertBefore(fragment, null)
  }
  snapshot () {
    const y = prosemirrorPluginKey.getState(this.editorView.state).y
    const history = y.define('history', Y.Array)
    const encoder = encoding.createEncoder()
    historyProtocol.writeHistorySnapshot(encoder, y)
    encoding.writeUint32(encoder, Math.floor(Date.now() / 1000))
    history.push([encoding.toBuffer(encoder)])
  }
}
