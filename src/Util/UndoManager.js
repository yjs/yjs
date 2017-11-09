import ID from './ID.js'

class ReverseOperation {
  constructor (y) {
    this.created = new Date()
    const beforeState = y._transaction.beforeState
    this.toState = new ID(y.userID, y.ss.getState(y.userID) - 1)
    if (beforeState.has(y.userID)) {
      this.fromState = new ID(y.userID, beforeState.get(y.userID))
    } else {
      this.fromState = this.toState
    }
    this.deletedStructs = y._transaction.deletedStructs
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

export default class UndoManager {
  constructor (scope, options = {}) {
    this.options = options
    options.captureTimeout = options.captureTimeout || 0
    this._undoBuffer = []
    this._redoBuffer = []
    this._scope = scope
    this._undoing = false
    this._redoing = false
    const y = scope._y
    this.y = y
    y.on('afterTransaction', (y, remote) => {
      if (!remote && (y._transaction.beforeState.has(y.userID) || y._transaction.deletedStructs.size > 0)) {
        let reverseOperation = new ReverseOperation(y)
        if (!this._undoing) {
          let lastUndoOp = this._undoBuffer.length > 0 ? this._undoBuffer[this._undoBuffer.length - 1] : null
          if (lastUndoOp !== null && lastUndoOp.created - reverseOperation.created <= options.captureTimeout) {
            console.log('appending', lastUndoOp, reverseOperation)
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
    console.log('undoing')
    this._undoing = true
    this._applyReverseOperation(this._undoBuffer)
    this._undoing = false
  }
  redo () {
    this._redoing = true
    this._applyReverseOperation(this._redoBuffer)
    this._redoing = false
  }
  _applyReverseOperation (reverseBuffer) {
    this.y.transact(() => {
      let performedUndo = false
      while (!performedUndo && reverseBuffer.length > 0) {
        let undoOp = reverseBuffer.pop()
        // make sure that it is possible to iterate {from}-{to}
        this.y.os.getItemCleanStart(undoOp.fromState)
        this.y.os.getItemCleanEnd(undoOp.toState)
        this.y.os.iterate(undoOp.fromState, undoOp.toState, op => {
          if (!op._deleted && isStructInScope(this.y, op, this._scope)) {
            performedUndo = true
            op._delete(this.y)
          }
        })
        for (let op of undoOp.deletedStructs) {
          if (
            isStructInScope(this.y, op, this._scope) &&
            op._parent !== this.y &&
            !op._parent._deleted &&
            (
              op._parent._id.user !== this.y.userID ||
              op._parent._id.clock < undoOp.fromState.clock ||
              op._parent._id.clock > undoOp.fromState.clock
            )
          ) {
            performedUndo = true
            op = op._copy(undoOp.deletedStructs)
            op._integrate(this.y)
          }
        }
      }
    })
  }
}
