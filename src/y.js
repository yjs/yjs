'use strict'

require('./Connector.js')(Y)
require('./Database.js')(Y)
require('./Transaction.js')(Y)
require('./Struct.js')(Y)
require('./Utils.js')(Y)
require('./Connectors/Test.js')(Y)

var requiringModules = {}

module.exports = Y

Y.extend = function (name, value) {
  Y[name] = value
  if (requiringModules[name] != null) {
    requiringModules[name].resolve()
    delete requiringModules[name]
  }
}

Y.requestModules = requestModules
function requestModules (modules) {
  var promises = []
  for (var i = 0; i < modules.length; i++) {
    var modulename = 'y-' + modules[i].toLowerCase()
    if (Y[modules[i]] == null) {
      if (requiringModules[modules[i]] == null) {
        try {
          require(modulename)(Y)
        } catch (e) {
          // module does not exist
          if (typeof window !== 'undefined') {
            var imported = document.createElement('script')
            imported.src = Y.sourceDir + '/' + modulename + '/' + modulename + '.js'
            document.head.appendChild(imported)

            let requireModule = {}
            requiringModules[modules[i]] = requireModule
            requireModule.promise = new Promise(function (resolve) {
              requireModule.resolve = resolve
            })
            promises.push(requireModule.promise)
          } else {
            throw e
          }
        }
      } else {
        promises.push(requiringModules[modules[i]].promise)
      }
    }
  }
  return Promise.all(promises)
}

require('./Types/Map.js')(Y)

function Y (opts) {
  opts.types = opts.types != null ? opts.types : []
  var modules = [opts.db.name, opts.connector.name].concat(opts.types)
  Y.sourceDir = opts.sourceDir
  return Y.requestModules(modules).then(function () {
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
      setTimeout(function () {
        callback()
      }, 0)
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
