/* @flow */
'use strict'

function Y (opts) {
  return new Promise(function (resolve) {
    var yconfig = new YConfig(opts, function () {
      yconfig.db.whenUserIdSet(function () {
        resolve(yconfig)
      })
    })
  })
}

class YConfig {
  constructor (opts, callback) {
    this.db = new Y[opts.db.name](this, opts.db)
    this.connector = new Y[opts.connector.name](this, opts.connector)
    this.db.requestTransaction(function * requestTransaction () {
      // create initial Map type
      var model = {
        id: ['_', 0],
        struct: 'Map',
        type: 'Map',
        map: {}
      }
      yield* this.store.tryExecute.call(this, model)
      var root = yield* this.getType(model.id)
      this.store.y.root = root
      callback()
    })
  }
  isConnected () {
    return this.connector.isSynced
  }
  disconnect () {
    return this.connector.disconnect()
  }
  reconnect () {
    return this.connector.reconnect()
  }
  destroy () {
    this.disconnect()
    this.db.destroy()
    this.connector = null
    this.db = null
  }
}

if (typeof YConcurrency_TestingMode !== 'undefined') {
  g.Y = Y //eslint-disable-line
  // debugger //eslint-disable-line
}
Y.utils = {}
