/* global Y */
'use strict'

function extend (Y) {
  class YArray {
    constructor (os, _model, idArray, valArray) {
      this.os = os
      this._model = _model
      // Array of all the operation id's
      this.idArray = idArray
      // Array of all the values
      this.valArray = valArray
      this.eventHandler = new Y.utils.EventHandler(ops => {
        var userEvents = []
        for (var i in ops) {
          var op = ops[i]
          if (op.struct === 'Insert') {
            let pos
            // we check op.left only!,
            // because op.right might not be defined when this is called
            if (op.left === null) {
              pos = 0
            } else {
              var sid = JSON.stringify(op.left)
              pos = this.idArray.indexOf(sid) + 1
              if (pos <= 0) {
                throw new Error('Unexpected operation!')
              }
            }
            this.idArray.splice(pos, 0, JSON.stringify(op.id))
            this.valArray.splice(pos, 0, op.content)
            userEvents.push({
              type: 'insert',
              object: this,
              index: pos,
              length: 1
            })
          } else if (op.struct === 'Delete') {
            let pos = this.idArray.indexOf(JSON.stringify(op.target))
            if (pos >= 0) {
              this.idArray.splice(pos, 1)
              this.valArray.splice(pos, 1)
              userEvents.push({
                type: 'delete',
                object: this,
                index: pos,
                length: 1
              })
            }
          } else {
            throw new Error('Unexpected struct!')
          }
        }
        this.eventHandler.callEventListeners(userEvents)
      })
    }
    get length () {
      return this.idArray.length
    }
    get (pos) {
      if (pos == null || typeof pos !== 'number') {
        throw new Error('pos must be a number!')
      }
      return this.valArray[pos]
    }
    toArray () {
      return this.valArray.slice()
    }
    insert (pos, contents) {
      if (typeof pos !== 'number') {
        throw new Error('pos must be a number!')
      }
      if (!(contents instanceof Array)) {
        throw new Error('contents must be an Array of objects!')
      }
      if (contents.length === 0) {
        return
      }
      if (pos > this.idArray.length || pos < 0) {
        throw new Error('This position exceeds the range of the array!')
      }
      var mostLeft = pos === 0 ? null : JSON.parse(this.idArray[pos - 1])

      var ops = []
      var prevId = mostLeft
      for (var i = 0; i < contents.length; i++) {
        var op = {
          left: prevId,
          origin: prevId,
          // right: mostRight,
          // NOTE: I intentionally do not define right here, because it could be deleted
          // at the time of creating this operation, and is therefore not defined in idArray
          parent: this._model,
          content: contents[i],
          struct: 'Insert',
          id: this.os.getNextOpId()
        }
        ops.push(op)
        prevId = op.id
      }
      var eventHandler = this.eventHandler
      eventHandler.awaitAndPrematurelyCall(ops)
      this.os.requestTransaction(function *() {
        // now we can set the right reference.
        var mostRight
        if (mostLeft != null) {
          mostRight = (yield* this.getOperation(mostLeft)).right
        } else {
          mostRight = (yield* this.getOperation(ops[0].parent)).start
        }
        for (var j in ops) {
          ops[j].right = mostRight
        }
        yield* this.applyCreatedOperations(ops)
        eventHandler.awaitedInserts(ops.length)
      })
    }
    delete (pos, length) {
      if (length == null) { length = 1 }
      if (typeof length !== 'number') {
        throw new Error('pos must be a number!')
      }
      if (typeof pos !== 'number') {
        throw new Error('pos must be a number!')
      }
      if (pos + length > this.idArray.length || pos < 0 || length < 0) {
        throw new Error('The deletion range exceeds the range of the array!')
      }
      if (length === 0) {
        return
      }
      var eventHandler = this.eventHandler
      var newLeft = pos > 0 ? JSON.parse(this.idArray[pos - 1]) : null
      var dels = []
      for (var i = 0; i < length; i++) {
        dels.push({
          target: JSON.parse(this.idArray[pos + i]),
          struct: 'Delete'
        })
      }
      eventHandler.awaitAndPrematurelyCall(dels)
      this.os.requestTransaction(function *() {
        yield* this.applyCreatedOperations(dels)
        eventHandler.awaitedDeletes(dels.length, newLeft)
      })
    }
    observe (f) {
      this.eventHandler.addEventListener(f)
    }
    * _changed (transaction, op) {
      if (!op.deleted) {
        if (op.struct === 'Insert') {
          var l = op.left
          var left
          while (l != null) {
            left = yield* transaction.getOperation(l)
            if (!left.deleted) {
              break
            }
            l = left.left
          }
          op.left = l
        }
        this.eventHandler.receivedOp(op)
      }
    }
  }

  Y.extend('Array', new Y.utils.CustomType({
    class: YArray,
    createType: function * YArrayCreator () {
      var modelid = this.store.getNextOpId()
      var model = {
        struct: 'List',
        type: 'Array',
        start: null,
        end: null,
        id: modelid
      }
      yield* this.applyCreatedOperations([model])
      return modelid
    },
    initType: function * YArrayInitializer (os, model) {
      var valArray = []
      var idArray = yield* Y.Struct.List.map.call(this, model, function (c) {
        valArray.push(c.content)
        return JSON.stringify(c.id)
      })
      return new YArray(os, model.id, idArray, valArray)
    }
  }))
}

if (typeof Y !== 'undefined') {
  extend(Y)
} else {
  module.exports = extend
}
