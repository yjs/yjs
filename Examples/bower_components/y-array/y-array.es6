(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* global Y */
'use strict'

function extend (Y) {
  class YArray {
    constructor (os, _model, _content) {
      this.os = os
      this._model = _model
      // Array of all the neccessary content (includes id (string formatted, and element value))
      this._content = _content
      this.eventHandler = new Y.utils.EventHandler(ops => {
        var userEvents = []
        for (var i = 0; i < ops.length; i++) {
          var op = ops[i]
          if (op.struct === 'Insert') {
            let pos
            // we check op.left only!,
            // because op.right might not be defined when this is called
            if (op.left === null) {
              pos = 0
            } else {
              let sid = JSON.stringify(op.left)
              pos = 1 + this._content.findIndex(function (c) {
                return c.id === sid
              })
              if (pos <= 0) {
                throw new Error('Unexpected operation!')
              }
            }
            this._content.splice(pos, 0, {
              id: JSON.stringify(op.id),
              val: op.content
            })
            userEvents.push({
              type: 'insert',
              object: this,
              index: pos,
              value: op.content,
              length: 1
            })
          } else if (op.struct === 'Delete') {
            let sid = JSON.stringify(op.target)
            let pos = this._content.findIndex(function (c) {
              return c.id === sid
            })
            if (pos >= 0) {
              var val = this._content[pos].val
              this._content.splice(pos, 1)
              userEvents.push({
                type: 'delete',
                object: this,
                index: pos,
                value: val,
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
    _destroy () {
      this.eventHandler.destroy()
      this.eventHandler = null
      this._content = null
      this._model = null
      this.os = null
    }
    get length () {
      return this._content.length
    }
    get (pos) {
      if (pos == null || typeof pos !== 'number') {
        throw new Error('pos must be a number!')
      }
      return this._content[pos].val
    }
    toArray () {
      return this._content.map(function (x) {
        return x.val
      })
    }
    push (contents) {
      this.insert(this._content.length, contents)
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
      if (pos > this._content.length || pos < 0) {
        throw new Error('This position exceeds the range of the array!')
      }
      var mostLeft = pos === 0 ? null : JSON.parse(this._content[pos - 1].id)

      var ops = []
      var prevId = mostLeft
      for (var i = 0; i < contents.length; i++) {
        var op = {
          left: prevId,
          origin: prevId,
          // right: mostRight,
          // NOTE: I intentionally do not define right here, because it could be deleted
          // at the time of inserting this operation (when we get the transaction),
          // and would therefore not defined in this._conten
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
        for (var j = 0; j < ops.length; j++) {
          ops[j].right = mostRight
        }
        yield* this.applyCreatedOperations(ops)
        eventHandler.awaitedInserts(ops.length)
      })
    }
    delete (pos, length) {
      if (length == null) { length = 1 }
      if (typeof length !== 'number') {
        throw new Error('length must be a number!')
      }
      if (typeof pos !== 'number') {
        throw new Error('pos must be a number!')
      }
      if (pos + length > this._content.length || pos < 0 || length < 0) {
        throw new Error('The deletion range exceeds the range of the array!')
      }
      if (length === 0) {
        return
      }
      var eventHandler = this.eventHandler
      var newLeft = pos > 0 ? JSON.parse(this._content[pos - 1].id) : null
      var dels = []
      for (var i = 0; i < length; i++) {
        dels.push({
          target: JSON.parse(this._content[pos + i].id),
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
    unobserve (f) {
      this.eventHandler.removeEventListener(f)
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
    name: 'Array', // TODO: copy the name when extending the object.. (see one line above)
    class: YArray,
    struct: 'List',
    initType: function * YArrayInitializer (os, model) {
      var _content = yield* Y.Struct.List.map.call(this, model, function (c) {
        return {
          id: JSON.stringify(c.id),
          val: c.content
        }
      })
      return new YArray(os, model.id, _content)
    }
  }))
}

module.exports = extend
if (typeof Y !== 'undefined') {
  extend(Y)
}

},{}]},{},[1])

