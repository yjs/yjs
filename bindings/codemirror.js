/**
 * @module bindings/textarea
 */

import { createMutex } from '../lib/mutex.js'
import * as math from '../lib/math.js'
import * as ypos from '../utils/relativePosition.js'

const typeObserver = (binding, event) => {
  binding._mux(() => {
    const cm = binding.target
    cm.operation(() => {
      const delta = event.delta
      let index = 0
      for (let i = 0; i < event.delta.length; i++) {
        const d = delta[i]
        if (d.retain) {
          index += d.retain
        } else if (d.insert) {
          const pos = cm.posFromIndex(index)
          cm.replaceRange(d.insert, pos, pos, 'prosemirror-binding')
          index += d.insert.length
        } else if (d.delete) {
          const start = cm.posFromIndex(index)
          const end = cm.posFromIndex(index + d.delete)
          cm.replaceRange('', start, end, 'prosemirror-binding')
        }
      }
    })
  })
}

const targetObserver = (binding, change) => {
  binding._mux(() => {
    const start = binding.target.indexFromPos(change.from)
    const delLen = change.removed.map(s => s.length).reduce(math.add) + change.removed.length - 1
    if (delLen > 0) {
      binding.type.delete(start, delLen)
    }
    if (change.text.length > 0) {
      binding.type.insert(start, change.text.join('\n'))
    }
  })
}

const createRemoteCaret = (username, color) => {
  const caret = document.createElement('span')
  caret.classList.add('remote-caret')
  caret.setAttribute('style', `border-color: ${color}`)
  const userDiv = document.createElement('div')
  userDiv.setAttribute('style', `background-color: ${color}`)
  userDiv.insertBefore(document.createTextNode(username), null)
  caret.insertBefore(userDiv, null)
  return caret
}

const updateRemoteSelection = (y, cm, type, cursors, clientId) => {
  // destroy current text mark
  const m = cursors.get(clientId)
  if (m !== undefined) {
    m.caret.clear()
    if (m.sel !== null) {
      m.sel.clear()
    }
    cursors.delete(clientId)
  }
  // redraw caret and selection for clientId
  const aw = y.awareness.get(clientId)
  if (aw === undefined) {
    return
  }
  const user = aw.user || {}
  if (user.color == null) {
    user.color = '#ffa500'
  }
  if (user.name == null) {
    user.name = `User: ${clientId}`
  }
  const cursor = aw.cursor
  if (cursor == null || cursor.anchor == null || cursor.head == null) {
    return
  }
  const anchor = ypos.fromRelativePosition(y, cursor.anchor || null)
  const head = ypos.fromRelativePosition(y, cursor.head || null)
  if (anchor !== null && head !== null && anchor.type === type && head.type === type) {
    const headpos = cm.posFromIndex(head.offset)
    const anchorpos = cm.posFromIndex(anchor.offset)
    let from, to
    if (head.offset < anchor.offset) {
      from = headpos
      to = anchorpos
    } else {
      from = anchorpos
      to = headpos
    }
    const caretEl = createRemoteCaret(user.name, user.color)
    const caret = cm.setBookmark(headpos, { widget: caretEl, insertLeft: true })
    let sel = null
    if (head.offset !== anchor.offset) {
      sel = cm.markText(from, to, { css: `background-color: ${user.color}70`, inclusiveRight: true, inclusiveLeft: false })
    }
    cursors.set(clientId, { caret, sel })
  }
}

const prosemirrorCursorActivity = (y, cm, type) => {
  if (!cm.hasFocus()) {
    return
  }
  const aw = y.getLocalAwarenessInfo()
  const anchor = ypos.getRelativePosition(type, cm.indexFromPos(cm.getCursor('anchor')))
  const head = ypos.getRelativePosition(type, cm.indexFromPos(cm.getCursor('head')))
  if (aw.cursor == null || !ypos.equal(aw.cursor.anchor, anchor) || !ypos.equal(aw.cursor.head, head)) {
    y.setAwarenessField('cursor', {
      anchor, head
    })
  }
}

/**
 * A binding that binds a YText to a CodeMirror editor.
 *
 * @example
 *   const ytext = ydocument.define('codemirror', Y.Text)
 *   const editor = new CodeMirror(document.querySelector('#container'), {
 *     mode: 'javascript',
 *     lineNumbers: true
 *   })
 *   const binding = new CodeMirrorBinding(editor)
 *
 */
export class CodeMirrorBinding {
  /**
   * @param {YText} textType
   * @param {CodeMirror} codeMirror
   * @param {Object} [options={cursors: true}]
   */
  constructor (textType, codeMirror, { cursors = true } = {}) {
    const y = textType._y
    this.type = textType
    this.target = codeMirror
    /**
     * @private
     */
    this._mux = createMutex()
    // set initial value
    codeMirror.setValue(textType.toString())
    // observe type and target
    this._typeObserver = event => typeObserver(this, event)
    this._targetObserver = (_, change) => targetObserver(this, change)
    this._cursors = new Map()
    this._awarenessListener = event => {
      const f = clientId => updateRemoteSelection(y, codeMirror, textType, this._cursors, clientId)
      event.added.forEach(f)
      event.removed.forEach(f)
      event.updated.forEach(f)
    }
    this._cursorListener = () => prosemirrorCursorActivity(y, codeMirror, textType)
    this._blurListeer = () =>
      y.setAwarenessField('cursor', null)
    textType.observe(this._typeObserver)
    codeMirror.on('change', this._targetObserver)
    if (cursors) {
      y.on('awareness', this._awarenessListener)
      codeMirror.on('cursorActivity', this._cursorListener)
      codeMirror.on('blur', this._blurListeer)
      codeMirror.on('focus', this._cursorListener)
    }
  }
  destroy () {
    this.type.unobserve(this._typeObserver)
    this.target.off('change', this._targetObserver)
    this.type.off('awareness', this._awarenessListener)
    this.target.off('cursorActivity', this._cursorListener)
    this.target.off('focus', this._cursorListener)
    this.target.off('blur', this._blurListeer)
    this.type = null
    this.target = null
  }
}
