/* @flow */
'use strict'

require('./Connector.js')(Y)
require('./Database.js')(Y)
require('./Transaction.js')(Y)
require('./Struct.js')(Y)
require('./Utils.js')(Y)
require('./Connectors/Test.js')(Y)

var requiringModules = {}

module.exports = Y
Y.requiringModules = requiringModules

Y.extend = function (name, value) {
  Y[name] = value
  if (requiringModules[name] != null) {
    requiringModules[name].resolve()
    delete requiringModules[name]
  }
}

Y.requestModules = requestModules
function requestModules (modules) {
  // determine if this module was compiled for es5 or es6 (y.js vs. y.es6)
  // if Insert.execute is a Function, then it isnt a generator..
  // then load the es5(.js) files..
  var extention = typeof regeneratorRuntime !== 'undefined' ? '.js' : '.es6'
  var promises = []
  for (var i = 0; i < modules.length; i++) {
    var modulename = 'y-' + modules[i].toLowerCase()
    if (Y[modules[i]] == null) {
      if (requiringModules[modules[i]] == null) {
        // module does not exist
        if (typeof window !== 'undefined' && window.Y !== 'undefined') {
          var imported = document.createElement('script')
          imported.src = Y.sourceDir + '/' + modulename + '/' + modulename + extention
          document.head.appendChild(imported)

          let requireModule = {}
          requiringModules[modules[i]] = requireModule
          requireModule.promise = new Promise(function (resolve) {
            requireModule.resolve = resolve
          })
          promises.push(requireModule.promise)
        } else {
          require(modulename)(Y)
        }
      } else {
        promises.push(requiringModules[modules[i]].promise)
      }
    }
  }
  return Promise.all(promises)
}

/* ::
type MemoryOptions = {
  name: 'memory'
}
type IndexedDBOptions = {
  name: 'indexeddb',
  namespace: string
}
type DbOptions = MemoryOptions | IndexedDBOptions

type WebRTCOptions = {
  name: 'webrtc',
  room: string
}
type WebsocketsClientOptions = {
  name: 'websockets-client',
  room: string
}
type ConnectionOptions = WebRTCOptions | WebsocketsClientOptions

type YOptions = {
  connector: ConnectionOptions,
  db: DbOptions,
  types: Array<TypeName>,
  sourceDir: string,
  share: {[key: string]: TypeName}
}
*/

function Y (opts/* :YOptions */) /* :Promise<YConfig> */ {
  opts.types = opts.types != null ? opts.types : []
  var modules = [opts.db.name, opts.connector.name].concat(opts.types)
  for (var name in opts.share) {
    modules.push(opts.share[name])
  }
  Y.sourceDir = opts.sourceDir
  return Y.requestModules(modules).then(function () {
    return new Promise(function (resolve, reject) {
      if (opts == null) reject('An options object is expected! ')
      else if (opts.connector == null) reject('You must specify a connector! (missing connector property)')
      else if (opts.connector.name == null) reject('You must specify connector name! (missing connector.name property)')
      else if (opts.db == null) reject('You must specify a database! (missing db property)')
      else if (opts.connector.name == null) reject('You must specify db name! (missing db.name property)')
      else if (opts.share == null) reject('You must specify a set of shared types!')
      else {
        var yconfig = new YConfig(opts)
        yconfig.db.whenUserIdSet(function () {
          yconfig.init(function () {
            resolve(yconfig)
          })
        })
      }
    })
  })
}

class YConfig {
  /* ::
  db: Y.AbstractDatabase;
  connector: Y.AbstractConnector;
  share: {[key: string]: any};
  options: Object;
  */
  constructor (opts, callback) {
    this.options = opts
    this.db = new Y[opts.db.name](this, opts.db)
    this.connector = new Y[opts.connector.name](this, opts.connector)
  }
  init (callback) {
    var opts = this.options
    var share = {}
    this.share = share
    this.db.requestTransaction(function * requestTransaction () {
      // create shared object
      for (var propertyname in opts.share) {
        var typename = opts.share[propertyname]
        var id = ['_', Y[typename].struct + '_' + propertyname]
        var op = yield* this.getOperation(id)
        if (op.type !== typename) {
          // not already in the db
          op.type = typename
          yield* this.setOperation(op)
        }
        share[propertyname] = yield* this.getType(id)
      }
      this.store.whenTransactionsFinished()
        .then(callback)
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
    if (this.connector.destroy != null) {
      this.connector.destroy()
    } else {
      this.connector.disconnect()
    }
    var self = this
    this.db.requestTransaction(function * () {
      yield* self.db.destroy()
      self.connector = null
      self.db = null
    })
  }
}

if (typeof window !== 'undefined') {
  window.Y = Y
}
