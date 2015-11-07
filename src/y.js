/* @flow */
'use strict'

require('./Connector.js')(Y)
require('./Database.js')(Y)
require('./Transaction.js')(Y)
require('./Struct.js')(Y)
require('./Utils.js')(Y)
require('./Databases/RedBlackTree.js')(Y)
require('./Databases/Memory.js')(Y)
require('./Databases/IndexedDB.js')(Y)
require('./Connectors/Test.js')(Y)

var requiringModules = {}

module.exports = Y

Y.extend = function (name, value) {
  Y[name] = value
  var resolves = requiringModules[name]
  if (requiringModules[name] != null) {
    for (var i = 0; i < resolves.length; i++) {
      resolves[i]()
    }
    delete requiringModules[name]
  }
}

require('./Types/Array.js')(Y)
require('./Types/Map.js')(Y)
require('./Types/TextBind.js')(Y)

function Y (opts) {
  opts.types = opts.types != null ? opts.types : []
  var modules = [opts.db.name, opts.connector.name].concat(opts.types)
  var promises = []
  for (var i = 0; i < modules.length; i++) {
    if (Y[modules[i]] == null) {
      try {
        require(modules[i])(Y)
      } catch (e) {
        // module does not exist
        if (window != null) {
          if (requiringModules[modules[i]] == null) {
            var imported = document.createElement('script')
            var name = modules[i].toLowerCase()
            imported.src = opts.sourceDir + '/y-' + name + '/y-' + name + '.js'
            document.head.appendChild(imported)
            requiringModules[modules[i]] = []
          }
          promises.push(new Promise(function (resolve) {
            requiringModules[modules[i]].push(resolve)
          }))
        } else {
          throw e
        }
      }
    }
  }
  return Promise.all(promises).then(function () {
    return new Promise(function (resolve) {
      var yconfig = new YConfig(opts, function () {
        yconfig.db.whenUserIdSet(function () {
          resolve(yconfig)
        })
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

if (typeof window !== 'undefined') {
  window.Y = Y
}
