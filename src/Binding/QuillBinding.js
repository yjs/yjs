import Binding from './Binding.js'

function typeObserver (event) {
  const quill = this.target
  quill.update('yjs')
  this._mutualExclude(function () {
    quill.updateContents(event.delta, 'yjs')
    quill.update('yjs') // ignore applied changes
  })
}

function quillObserver (delta) {
  this._mutualExclude(() => {
    this.type.applyDelta(delta.ops)
  })
}

/**
 * A Binding that binds a YText type to a Quill editor
 *
 * @example
 *   const quill = new Quill(document.createElement('div'))
 *   const type = y.define('quill', Y.Text)
 *   const binding = new Y.QuillBinding(quill, type)
 */
export default class QuillBinding extends Binding {
  /**
   * @param {YText} textType
   * @param {Quill} quill
   */
  constructor (textType, quill) {
    // Binding handles textType as this.type and quill as this.target
    super(textType, quill)
    // set initial value
    quill.setContents(textType.toDelta(), 'yjs')
    // Observers are handled by this class
    this._typeObserver = typeObserver.bind(this)
    this._quillObserver = quillObserver.bind(this)
    textType.observe(this._typeObserver)
    quill.on('text-change', this._quillObserver)
  }
  destroy () {
    // Remove everything that is handled by this class
    this.type.unobserve(this._typeObserver)
    this.target.off('text-change', this._quillObserver)
    super.destroy()
  }
}
