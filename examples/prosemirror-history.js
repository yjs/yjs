
import {Plugin} from 'prosemirror-state'
import crel from 'crel'
import * as Y from '../index.js'
import { prosemirrorPluginKey } from '../bindings/prosemirror.js'
import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
import * as historyProtocol from '../protocols/history.js'

const niceColors = ['#3cb44b', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#008080', '#9a6324', '#800000', '#808000', '#000075', '#808080']

const createUserCSS = (userid, username, color = 'rgb(250, 129, 0)', color2 = 'rgba(250, 129, 0, .41)') => `
  [ychange_state][ychange_user="${userid}"]:hover::before {
    content: "${username}" !important;
    background-color: ${color} !important;
  }
  [ychange_state="added"][ychange_user="${userid}"] {
    background-color: ${color2} !important;
  }
  [ychange_state="removed"][ychange_user="${userid}"] {
    color: ${color} !important;
  }
`

export const noteHistoryPlugin = new Plugin({
  state: {
    init (initargs, state) {
      return new NoteHistoryPlugin()
    },
    apply (tr, pluginState) {
      return pluginState
    }
  },
  view (editorView) {
    const hstate = noteHistoryPlugin.getState(editorView.state)
    hstate.init(editorView)
    return {
      destroy: hstate.destroy.bind(hstate)
    }
  }
})

const createWrapper = () => {
  const wrapper = crel('div', { style: 'display: flex;' })
  const historyContainer = crel('div', { style: 'align-self: baseline; flex-basis: 250px;', class: 'shared-history' })
  wrapper.insertBefore(historyContainer, null)
  const userStyleContainer = crel('style')
  wrapper.insertBefore(userStyleContainer, null)
  return { wrapper, historyContainer, userStyleContainer }
}

class NoteHistoryPlugin {
  init (editorView) {
    this.editorView = editorView
    const { historyContainer, wrapper, userStyleContainer } = createWrapper()
    this.userStyleContainer = userStyleContainer
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
  destroy () {
    this.wrapper.parentNode.replaceChild(this.wrapper.firstChild, this.wrapper)
    const y = prosemirrorPluginKey.getState(this.editorView.state).y
    const history = y.define('history', Y.Array)
    history.unobserve(this.render)
  }
  render () {
    const y = prosemirrorPluginKey.getState(this.editorView.state).y
    const history = y.define('history', Y.Array).toArray()
    const fragment = document.createDocumentFragment()
    const snapshotBtn = crel('button', { type: 'button' }, ['snapshot'])
    fragment.insertBefore(snapshotBtn, null)
    let _prevSnap = null // empty
    snapshotBtn.addEventListener('click', () => {
      const awareness = y.getAwarenessInfo()
      const userMap = new Map()
      const aw = y.getLocalAwarenessInfo()
      userMap.set(y.userID, aw.name || 'unknown')
      awareness.forEach((a, userID) => {
        userMap.set(userID, a.name || 'Unknown')
      })
      this.snapshot(userMap)
    })
    history.forEach(buf => {
      const decoder = decoding.createDecoder(buf)
      const snapshot = historyProtocol.readHistorySnapshot(decoder)
      const date = new Date(decoding.readUint32(decoder) * 1000)
      const restoreBtn = crel('button', { type: 'button' }, ['restore'])
      const a = crel('a', [
        '• ' + date.toUTCString(), restoreBtn
      ])
      const el = crel('div', [ a ])
      let prevSnapshot = _prevSnap // rebind to new variable
      restoreBtn.addEventListener('click', event => {
        if (prevSnapshot === null) {
          prevSnapshot = { ds: snapshot.ds, sm: new Map() }
        }
        this.editorView.dispatch(this.editorView.state.tr.setMeta(prosemirrorPluginKey, { snapshot, prevSnapshot, restore: true }))
        event.stopPropagation()
      })
      a.addEventListener('click', () => {
        console.log('setting snapshot')
        if (prevSnapshot === null) {
          prevSnapshot = { ds: snapshot.ds, sm: new Map() }
        }
        this.renderSnapshot(snapshot, prevSnapshot)
      })
      fragment.insertBefore(el, null)
      _prevSnap = snapshot
    })
    this.historyContainer.innerHTML = ''
    this.historyContainer.insertBefore(fragment, null)
  }
  renderSnapshot (snapshot, prevSnapshot) {
    this.editorView.dispatch(this.editorView.state.tr.setMeta(prosemirrorPluginKey, { snapshot, prevSnapshot }))
    /**
     * @type {Array<string|null>}
     */
    let colors = niceColors.slice()
    let style = ''
    snapshot.userMap.forEach((name, userid) => {
      /**
       * @type {any}
       */
      const randInt = name.split('').map(s => s.charCodeAt(0)).reduce((a, b) => a + b)
      let color = null
      let i = 0
      for (; i < colors.length && color === null; i++) {
        color = colors[(randInt + i) % colors.length]
      }
      if (color === null) {
        colors = niceColors.slice()
        i = 0
        color = colors[randInt % colors.length]
      }
      colors[randInt % colors.length] = null
      style += createUserCSS(userid, name, color, color + '69')
    })
    this.userStyleContainer.innerHTML = style
  }
  /**
   * @param {Map<number, string>} [updatedUserMap] Maps from userid (yjs model) to account name (e.g. mail address)
   */
  snapshot (updatedUserMap = new Map()) {
    const y = prosemirrorPluginKey.getState(this.editorView.state).y
    const history = y.define('history', Y.Array)
    const encoder = encoding.createEncoder()
    historyProtocol.writeHistorySnapshot(encoder, y, updatedUserMap)
    encoding.writeUint32(encoder, Math.floor(Date.now() / 1000))
    history.push([encoding.toBuffer(encoder)])
  }
}
