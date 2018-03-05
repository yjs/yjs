import ID from './ID.js'

class ReverseOperation {
  constructor (y, transaction) {
    this.created = new Date()
    const beforeState = transaction.beforeState
    if (beforeState.has(y.userID)) {
      this.toState = new ID(y.userID, y.ss.getState(y.userID) - 1)
      this.fromState = new ID(y.userID, beforeState.get(y.userID))
    } else {
      this.toState = null
      this.fromState = null
    }
    this.deletedStructs = transaction.deletedStructs
  }
}

function isStructInScope (y, struct, scope) {
  while (struct !== y) {
    if (struct === scope) {
      return true
    }
    struct = struct._parent
  }
  return false
}

function applyReverseOperation (y, scope, reverseBuffer) {
  let performedUndo = false
  y.transact(() => {
    while (!performedUndo && reverseBuffer.length > 0) {
      let undoOp = reverseBuffer.pop()
      // make sure that it is possible to iterate {from}-{to}
      if (undoOp.fromState !== null) {
        y.os.getItemCleanStart(undoOp.fromState)
        y.os.getItemCleanEnd(undoOp.toState)
        y.os.iterate(undoOp.fromState, undoOp.toState, op => {
          while (op._deleted && op._redone !== null) {
            op = op._redone
          }
          if (op._deleted === false && isStructInScope(y, op, scope)) {
            performedUndo = true
            op._delete(y)
          }
        })
      }
      for (let op of undoOp.deletedStructs) {
        if (
          isStructInScope(y, op, scope) &&
          op._parent !== y &&
          (
            op._id.user !== y.userID ||
            undoOp.fromState === null ||
            op._id.clock < undoOp.fromState.clock ||
            op._id.clock > undoOp.toState.clock
          )
        ) {
          performedUndo = true
          op._redo(y)
        }
      }
    }
  })
  return performedUndo
}

/**
 * Saves a history of locally applied operations. The UndoManager handles the
 * undoing and redoing of locally created changes.
 */
export default class UndoManager {
  /**
   * @param {YType} scope The scope on which to listen for changes.
   * @param {Object} options Optionally provided configuration.
   */
  constructor (scope, options = {}) {
    this.options = options
    options.captureTimeout = options.captureTimeout == null ? 500 : options.captureTimeout
    this._undoBuffer = []
    this._redoBuffer = []
    this._scope = scope
    this._undoing = false
    this._redoing = false
    const y = scope._y
    this.y = y
    y.on('afterTransaction', (y, transaction, remote) => {
      if (!remote && transaction.changedParentTypes.has(scope)) {
        let reverseOperation = new ReverseOperation(y, transaction)
        if (!this._undoing) {
          let lastUndoOp = this._undoBuffer.length > 0 ? this._undoBuffer[this._undoBuffer.length - 1] : null
          if (lastUndoOp !== null && reverseOperation.created - lastUndoOp.created <= options.captureTimeout) {
            lastUndoOp.created = reverseOperation.created
            if (reverseOperation.toState !== null) {
              lastUndoOp.toState = reverseOperation.toState
              if (lastUndoOp.fromState === null) {
                lastUndoOp.fromState = reverseOperation.fromState
              }
            }
            reverseOperation.deletedStructs.forEach(lastUndoOp.deletedStructs.add, lastUndoOp.deletedStructs)
          } else {
            this._undoBuffer.push(reverseOperation)
          }
          if (!this._redoing) {
            this._redoBuffer = []
          }
        } else {
          this._redoBuffer.push(reverseOperation)
        }
      }
    })
  }

  /**
   * Undo the last locally created change.
   */
  undo () {
    this._undoing = true
    const performedUndo = applyReverseOperation(this.y, this._scope, this._undoBuffer)
    this._undoing = false
    return performedUndo
  }

  /**
   * Redo the last locally created change.
   */
  redo () {
    this._redoing = true
    const performedRedo = applyReverseOperation(this.y, this._scope, this._redoBuffer)
    this._redoing = false
    return performedRedo
  }
}
