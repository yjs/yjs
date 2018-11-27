/**
 * @module bindings/quill
 */

import { createMutex } from '../lib/mutex.js'

const typeObserver = function (event) {
  const quill = this.target
  // Force flush Quill changes.
  quill.update('yjs')
  this._mutualExclude(() => {
    // Apply computed delta.
    quill.updateContents(event.delta, 'yjs')
    // Force flush Quill changes. Ignore applied changes.
    quill.update('yjs')
  })
}

const quillObserver = function (delta) {
  this._mutualExclude(() => {
    this.type.applyDelta(delta.ops)
  })
}

/**
 * A Binding that binds a YText type to a Quill editor.
 *
 * @example
 * const quill = new Quill(document.createElement('div'))
 * const type = y.define('quill', Y.Text)
 * const binding = new Y.QuillBinding(quill, type)
 * // Now modifications on the DOM will be reflected in the Type, and the other
 * // way around!
 */
export class QuillBinding {
  /**
   * @param {YText} textType
   * @param {Quill} quill
   */
  constructor (textType, quill) {
    // Binding handles textType as this.type and quill as this.target.
    /**
     * The Yjs type that is bound to `target`
     * @type {YText}
     */
    this.type = textType
    /**
     * The target that `type` is bound to.
     * @type {Quill}
     */
    this.target = quill
    /**
     * @private
     */
    this._mutualExclude = createMutex()
    // Set initial value.
    quill.setContents(textType.toDelta(), 'yjs')
    // Observers are handled by this class.
    this._typeObserver = typeObserver.bind(this)
    this._quillObserver = quillObserver.bind(this)
    textType.observe(this._typeObserver)
    quill.on('text-change', this._quillObserver)
  }
  destroy () {
    // Remove everything that is handled by this class.
    this.type.unobserve(this._typeObserver)
    this.target.off('text-change', this._quillObserver)
    this.type = null
    this.target = null
  }
}
