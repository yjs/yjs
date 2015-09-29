/* global Y */
'use strict'

;(function () {
  class YMap {
    constructor (os, model) {
      this._model = model.id
      this.os = os
      this.map = Y.utils.copyObject(model.map)
      this.contents = {}
      this.opContents = {}
      this.eventHandler = new Y.utils.EventHandler(ops => {
        var userEvents = []
        for (var i in ops) {
          var op = ops[i]
          var oldValue
          // key is the name to use to access (op)content
          var key = op.struct === 'Delete' ? op.key : op.parentSub

          // compute oldValue
          if (this.opContents[key] != null) {
            let prevType = this.opContents[key]
            oldValue = () => {// eslint-disable-line
              return new Promise((resolve) => {
                this.os.requestTransaction(function *() {// eslint-disable-line
                  resolve(yield* this.getType(prevType))
                })
              })
            }
          } else {
            oldValue = this.contents[key]
          }
          // compute op event
          if (op.struct === 'Insert') {
            if (op.left === null) {
              if (op.opContent != null) {
                delete this.contents[key]
                if (op.deleted) {
                  delete this.opContents[key]
                } else {
                  this.opContents[key] = op.opContent
                }
              } else {
                delete this.opContents[key]
                if (op.deleted) {
                  delete this.contents[key]
                } else {
                  this.contents[key] = op.content
                }
              }
              this.map[key] = op.id
              var insertEvent = {
                name: key,
                object: this
              }
              if (oldValue === undefined) {
                insertEvent.type = 'add'
              } else {
                insertEvent.type = 'update'
                insertEvent.oldValue = oldValue
              }
              userEvents.push(insertEvent)
            }
          } else if (op.struct === 'Delete') {
            if (Y.utils.compareIds(this.map[key], op.target)) {
              delete this.opContents[key]
              delete this.contents[key]
              var deleteEvent = {
                name: key,
                object: this,
                oldValue: oldValue,
                type: 'delete'
              }
              userEvents.push(deleteEvent)
            }
          } else {
            throw new Error('Unexpected Operation!')
          }
        }
        this.eventHandler.callEventListeners(userEvents)
      })
    }
    get (key) {
      // return property.
      // if property does not exist, return null
      // if property is a type, return a promise
      if (this.opContents[key] == null) {
        if (key == null) {
          return Y.utils.copyObject(this.contents)
        } else {
          return this.contents[key]
        }
      } else {
        return new Promise((resolve) => {
          var oid = this.opContents[key]
          this.os.requestTransaction(function *() {
            resolve(yield* this.getType(oid))
          })
        })
      }
    }
    delete (key) {
      var right = this.map[key]
      if (right != null) {
        var del = {
          target: right,
          struct: 'Delete'
        }
        var eventHandler = this.eventHandler
        var modDel = Y.utils.copyObject(del)
        modDel.key = key
        eventHandler.awaitAndPrematurelyCall([modDel])
        this.os.requestTransaction(function *() {
          yield* this.applyCreatedOperations([del])
          eventHandler.awaitedDeletes(1)
        })
      }
    }
    set (key, value) {
      // set property.
      // if property is a type, return a promise
      // if not, apply immediately on this type an call event

      var right = this.map[key] || null
      var insert = {
        left: null,
        right: right,
        origin: null,
        parent: this._model,
        parentSub: key,
        struct: 'Insert'
      }
      return new Promise((resolve) => {
        if (value instanceof Y.utils.CustomType) {
          // construct a new type
          this.os.requestTransaction(function *() {
            var typeid = yield* value.createType.call(this)
            var type = yield* this.getType(typeid)
            insert.opContent = typeid
            insert.id = this.store.getNextOpId()
            yield* this.applyCreatedOperations([insert])
            resolve(type)
          })
        } else {
          insert.content = value
          insert.id = this.os.getNextOpId()
          var eventHandler = this.eventHandler
          eventHandler.awaitAndPrematurelyCall([insert])

          this.os.requestTransaction(function *() {
            yield* this.applyCreatedOperations([insert])
            eventHandler.awaitedInserts(1)
          })
          resolve(value)
        }
      })
    }
    observe (f) {
      this.eventHandler.addEventListener(f)
    }
    unobserve (f) {
      this.eventHandler.removeEventListener(f)
    }
    observePath (path, f) {
      var self = this
      if (path.length === 0) {
        this.observe(f)
        return Promise.resolve(function () {
          self.unobserve(f)
        })
      } else {
        var deleteChildObservers
        var resetObserverPath = function () {
          var promise = self.get(path[0])
          if (!promise instanceof Promise) {
            // its either not defined or a premitive value
            promise = self.set(path[0], Y.Map)
          }
          return promise.then(function (map) {
            return map.observePath(path.slice(1), f)
          }).then(function (_deleteChildObservers) {
            deleteChildObservers = _deleteChildObservers
            return Promise.resolve()
          })
        }
        var observer = function (events) {
          for (var e in events) {
            var event = events[e]
            if (event.name === path[0]) {
              deleteChildObservers()
              if (event.type === 'add' || event.type === 'update') {
                resetObserverPath()
              }
            }
          }
        }
        self.observe(observer)
        return resetObserverPath().then(
          Promise.resolve(function () {
            deleteChildObservers()
            self.unobserve(observer)
          })
        )
      }
    }
    * _changed (transaction, op) {
      if (op.struct === 'Delete') {
        op.key = (yield* transaction.getOperation(op.target)).parentSub
      }
      this.eventHandler.receivedOp(op)
    }
  }
  Y.Map = new Y.utils.CustomType({
    class: YMap,
    createType: function * YMapCreator () {
      var modelid = this.store.getNextOpId()
      var model = {
        map: {},
        struct: 'Map',
        type: 'Map',
        id: modelid
      }
      yield* this.applyCreatedOperations([model])
      return modelid
    },
    initType: function * YMapInitializer (os, model) { // eslint-disable-line
      return new YMap(os, model)
    }
  })
})()
