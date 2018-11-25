/**
 * @module bindings/textarea
 */

import { simpleDiff } from '../lib/diff.js'
import { getRelativePosition, fromRelativePosition } from '../utils/relativePosition.js'
import { createMutex } from '../lib/mutex.js'

function typeObserver () {
  this._mutualExclude(() => {
    const textarea = this.target
    const textType = this.type
    const relativeStart = getRelativePosition(textType, textarea.selectionStart)
    const relativeEnd = getRelativePosition(textType, textarea.selectionEnd)
    textarea.value = textType.toString()
    const start = fromRelativePosition(textType._y, relativeStart)
    const end = fromRelativePosition(textType._y, relativeEnd)
    textarea.setSelectionRange(start, end)
  })
}

function domObserver () {
  this._mutualExclude(() => {
    let diff = simpleDiff(this.type.toString(), this.target.value)
    this.type.delete(diff.pos, diff.remove)
    this.type.insert(diff.pos, diff.insert)
  })
}

/**
 * A binding that binds a YText to a dom textarea.
 *
 * This binding is automatically destroyed when its parent is deleted.
 *
 * @example
 *   const textare = document.createElement('textarea')
 *   const type = y.define('textarea', Y.Text)
 *   const binding = new Y.QuillBinding(type, textarea)
 *
 */
export class TextareaBinding {
  constructor (textType, domTextarea) {
    /**
     * The Yjs type that is bound to `target`
     * @type {Type}
     */
    this.type = textType
    /**
     * The target that `type` is bound to.
     * @type {*}
     */
    this.target = domTextarea
    /**
     * @private
     */
    this._mutualExclude = createMutex()
    // set initial value
    domTextarea.value = textType.toString()
    // Observers are handled by this class
    this._typeObserver = typeObserver.bind(this)
    this._domObserver = domObserver.bind(this)
    textType.observe(this._typeObserver)
    domTextarea.addEventListener('input', this._domObserver)
  }
  destroy () {
    // Remove everything that is handled by this class
    this.type.unobserve(this._typeObserver)
    this.target.unobserve(this._domObserver)
    this.type = null
    this.target = null
  }
}
