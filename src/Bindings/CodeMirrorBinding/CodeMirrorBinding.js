import Binding from '../Binding.js'

function typeObserver (event) {
  this._mutualExclude(() => {
    const codeMirror = this.target;
    var deltas = event.delta;
    var index = 0;
    var from = codeMirror.posFromIndex(index);
    for (var i = 0; i < deltas.length; i++) {
        var delta = deltas[i];
        if (delta.retain) {
            index = delta.retain;
            from = codeMirror.posFromIndex(index);
        } else if (delta.insert) {
            codeMirror.replaceRange(delta.insert, from, from)
        } else if (delta.delete) {
            codeMirror.replaceRange('', from, codeMirror.posFromIndex(index + delta.delete))
        }
    }
  });
}

function codeMirrorObserver(codeMirror, deltas) {
  this._mutualExclude(() => {
    for (var i = 0; i < deltas.length; i++) {
      var delta = deltas[i]
      var start = codeMirror.indexFromPos(delta.from)
      // apply the delete operation first
      if (delta.removed.length > 0) {
        var delLength = 0
        for (var j = 0; j < delta.removed.length; j++) {
          delLength += delta.removed[j].length
        }
        // "enter" is also a character in our case
        delLength += delta.removed.length - 1
        this.type.delete(start, delLength)
      }
      // apply insert operation
      this.type.insert(start, delta.text.join('\n'))
    }
  });
}

/**
 * A binding that binds a YText to a codemirror.
 *
 * This binding is automatically destroyed when its parent is deleted.
 *
 */
export default class CodeMirrorBinding extends Binding {
  constructor (textType, codeMirror) {
    super(textType, codeMirror)
    // set initial value
    codeMirror.setValue(textType.toString())
    // Observers are handled by this class
    this._typeObserver = typeObserver.bind(this)
    this._codeMirrorObserver = codeMirrorObserver.bind(this)
    textType.observe(this._typeObserver)
    codeMirror.on('changes', this._codeMirrorObserver)
  }
  destroy () {
    // Remove everything that is handled by this class
    this.type.unobserve(this._typeObserver)
    this.target.unobserve(this._codeMirrorObserver)
    super.destroy()
  }
}
