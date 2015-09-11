/* @flow */
'use strict'

function Y (opts) {
  var def = Promise.defer()
  new YConfig(opts, function (yconfig) { // eslint-disable-line
    yconfig.db.whenUserIdSet(function () {
      def.resolve(yconfig)
    })
  })
  return def.promise
}

class YConfig { // eslint-disable-line no-unused-vars
  constructor (opts, callback) {
    this.db = new Y[opts.db.name](this, opts.db)
    this.connector = new Y[opts.connector.name](this, opts.connector)
    var yconfig = this
    this.db.requestTransaction(function * requestTransaction () {
      // create initial Map type
      var model = {
        id: ['_', 0],
        struct: 'Map',
        type: 'Map',
        map: {}
      }
      yield* this.addOperation(model)
      var root = yield* this.createType(model)
      this.store.y.root = root
      callback(yconfig)
    })
  }
  isConnected () {
    return this.connector.isSynced
  }
  disconnect () {
    this.connector.disconnect()
  }
  reconnect () {
    Promise.all([
      this.db.garbageCollect(),
      this.db.garbageCollect()
    ]).then(() => {
      this.connector.reconnect()
    })
  }
  destroy () {
    this.connector.disconnect()
    this.db.destroy()
    this.connector = null
    this.db = null
    this.transact = function () {
      throw new Error('Remember?, you destroyed this type ;)')
    }
  }
}

if (g) { // eslint-disable-line
  g.Y = Y //eslint-disable-line
  debugger //eslint-disable-line
}
Y.utils = {}
