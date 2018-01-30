import ID from './ID.js'

class ReverseOperation {
  constructor (y, transaction) {
    this.created = new Date()
    const beforeState = transaction.beforeState
    this.toState = new ID(y.userID, y.ss.getState(y.userID) - 1)
    if (beforeState.has(y.userID)) {
      this.fromState = new ID(y.userID, beforeState.get(y.userID))
    } else {
      this.fromState = this.toState
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
      y.os.getItemCleanStart(undoOp.fromState)
      y.os.getItemCleanEnd(undoOp.toState)
      y.os.iterate(undoOp.fromState, undoOp.toState, op => {
        if (!op._deleted && isStructInScope(y, op, scope)) {
          performedUndo = true
          op._delete(y)
        }
      })
      for (let op of undoOp.deletedStructs) {
        if (
          isStructInScope(y, op, scope) &&
          op._parent !== y &&
          !op._parent._deleted &&
          (
            op._parent._id.user !== y.userID ||
            op._parent._id.clock < undoOp.fromState.clock ||
            op._parent._id.clock > undoOp.fromState.clock
          )
        ) {
          performedUndo = true
          op = op._copy(undoOp.deletedStructs, true)
          op._integrate(y)
        }
      }
    }
  })
  return performedUndo
}

export default class UndoManager {
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
            lastUndoOp.toState = reverseOperation.toState
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
  undo () {
    this._undoing = true
    const performedUndo = applyReverseOperation(this.y, this._scope, this._undoBuffer)
    this._undoing = false
    return performedUndo
  }
  redo () {
    this._redoing = true
    const performedRedo = applyReverseOperation(this.y, this._scope, this._redoBuffer)
    this._redoing = false
    return performedRedo
  }
}
