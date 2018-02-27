
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

export default class QuillBinding extends Binding {
  constructor (textType, quillInstance) {
    // Binding handles textType as this.type and quillInstance as this.target
    super(textType, quillInstance)
    // set initial value
    quillInstance.setContents(textType.toDelta(), 'yjs')
    // Observers are handled by this class
    this._typeObserver = typeObserver.bind(this)
    this._quillObserver = quillObserver.bind(this)
    textType.observe(this._typeObserver)
    quillInstance.on('text-change', this._quillObserver)
  }
  destroy () {
    // Remove everything that is handled by this class
    this.type.unobserve(this._typeObserver)
    this.target.off('text-change', this._quillObserver)
    super.destroy()
  }
}
