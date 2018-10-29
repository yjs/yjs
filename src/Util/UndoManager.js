import * as ID from './ID.js'
import isParentOf from './isParentOf.js'

class ReverseOperation {
  constructor (y, transaction, bindingInfos) {
    this.created = new Date()
    const beforeState = transaction.beforeState
    if (beforeState.has(y.userID)) {
      this.toState = ID.createID(y.userID, y.ss.getState(y.userID) - 1)
      this.fromState = ID.createID(y.userID, beforeState.get(y.userID))
    } else {
      this.toState = null
      this.fromState = null
    }
    this.deletedStructs = new Set()
    transaction.deletedStructs.forEach(struct => {
      this.deletedStructs.add({
        from: struct._id,
        len: struct._length
      })
    })
    /**
     * Maps from binding to binding information (e.g. cursor information)
     */
    this.bindingInfos = bindingInfos
  }
}

function applyReverseOperation (y, scope, reverseBuffer) {
  let performedUndo = false
  let undoOp = null
  y.transact(() => {
    while (!performedUndo && reverseBuffer.length > 0) {
      undoOp = reverseBuffer.pop()
      // make sure that it is possible to iterate {from}-{to}
      if (undoOp.fromState !== null) {
        y.os.getItemCleanStart(undoOp.fromState)
        y.os.getItemCleanEnd(undoOp.toState)
        y.os.iterate(undoOp.fromState, undoOp.toState, op => {
          while (op._deleted && op._redone !== null) {
            op = op._redone
          }
          if (op._deleted === false && isParentOf(scope, op)) {
            performedUndo = true
            op._delete(y)
          }
        })
      }
      const redoitems = new Set()
      for (let del of undoOp.deletedStructs) {
        const fromState = del.from
        const toState = ID.createID(fromState.user, fromState.clock + del.len - 1)
        y.os.getItemCleanStart(fromState)
        y.os.getItemCleanEnd(toState)
        y.os.iterate(fromState, toState, op => {
          if (
            isParentOf(scope, op) &&
            op._parent !== y &&
            (
              op._id.user !== y.userID ||
              undoOp.fromState === null ||
              op._id.clock < undoOp.fromState.clock ||
              op._id.clock > undoOp.toState.clock
            )
          ) {
            redoitems.add(op)
          }
        })
      }
      redoitems.forEach(op => {
        const opUndone = op._redo(y, redoitems)
        performedUndo = performedUndo || opUndone
      })
    }
  })
  if (performedUndo && undoOp !== null) {
    // should be performed after the undo transaction
    undoOp.bindingInfos.forEach((info, binding) => {
      binding._restoreUndoStackInfo(info)
    })
  }
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
    this._bindings = new Set(options.bindings)
    options.captureTimeout = options.captureTimeout == null ? 500 : options.captureTimeout
    this._undoBuffer = []
    this._redoBuffer = []
    this._scope = scope
    this._undoing = false
    this._redoing = false
    this._lastTransactionWasUndo = false
    const y = scope._y
    this.y = y
    y._hasUndoManager = true
    let bindingInfos
    y.on('beforeTransaction', (y, transaction, remote) => {
      if (!remote) {
        // Store binding information before transaction is executed
        // By restoring the binding information, we can make sure that the state
        // before the transaction can be recovered
        bindingInfos = new Map()
        this._bindings.forEach(binding => {
          bindingInfos.set(binding, binding._getUndoStackInfo())
        })
      }
    })
    y.on('afterTransaction', (y, transaction, remote) => {
      if (!remote && transaction.changedParentTypes.has(scope)) {
        let reverseOperation = new ReverseOperation(y, transaction, bindingInfos)
        if (!this._undoing) {
          let lastUndoOp = this._undoBuffer.length > 0 ? this._undoBuffer[this._undoBuffer.length - 1] : null
          if (
            this._redoing === false &&
            this._lastTransactionWasUndo === false &&
            lastUndoOp !== null &&
            (options.captureTimeout < 0 || reverseOperation.created - lastUndoOp.created <= options.captureTimeout)
          ) {
            lastUndoOp.created = reverseOperation.created
            if (reverseOperation.toState !== null) {
              lastUndoOp.toState = reverseOperation.toState
              if (lastUndoOp.fromState === null) {
                lastUndoOp.fromState = reverseOperation.fromState
              }
            }
            reverseOperation.deletedStructs.forEach(lastUndoOp.deletedStructs.add, lastUndoOp.deletedStructs)
          } else {
            this._lastTransactionWasUndo = false
            this._undoBuffer.push(reverseOperation)
          }
          if (!this._redoing) {
            this._redoBuffer = []
          }
        } else {
          this._lastTransactionWasUndo = true
          this._redoBuffer.push(reverseOperation)
        }
      }
    })
  }

  /**
   * Enforce that the next change is created as a separate item in the undo stack
   */
  flushChanges () {
    this._lastTransactionWasUndo = true
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
