
import { createMutex } from '../../lib/mutex.js'

/**
 * Abstract class for bindings.
 *
 * A binding handles data binding from a Yjs type to a data object. For example,
 * you can bind a Quill editor instance to a YText instance with the `QuillBinding` class.
 *
 * It is expected that a concrete implementation accepts two parameters
 * (type and binding target).
 *
 * @example
 *   const quill = new Quill(document.createElement('div'))
 *   const type = y.define('quill', Y.Text)
 *   const binding = new Y.QuillBinding(quill, type)
 *
 */
export default class Binding {
  /**
   * @param {YType} type Yjs type.
   * @param {any} target Binding Target.
   */
  constructor (type, target) {
    /**
     * The Yjs type that is bound to `target`
     * @type {YType}
     */
    this.type = type
    /**
     * The target that `type` is bound to.
     * @type {*}
     */
    this.target = target
    /**
     * @private
     */
    this._mutualExclude = createMutex()
  }
  /**
   * Remove all data observers (both from the type and the target).
   */
  destroy () {
    this.type = null
    this.target = null
  }
}
