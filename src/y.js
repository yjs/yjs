import extendConnector from './Connector.js'
import extendPersistence from './Persistence.js'
import extendDatabase from './Database.js'
import extendTransaction from './Transaction.js'
import extendStruct from './Struct.js'
import extendUtils from './Utils.js'
import debug from 'debug'
import { formatYjsMessage, formatYjsMessageType } from './MessageHandler.js'

extendConnector(Y)
extendPersistence(Y)
extendDatabase(Y)
extendTransaction(Y)
extendStruct(Y)
extendUtils(Y)

Y.debug = debug
debug.formatters.Y = formatYjsMessage
debug.formatters.y = formatYjsMessageType

var requiringModules = {}

Y.requiringModules = requiringModules

Y.extend = function (name, value) {
  if (arguments.length === 2 && typeof name === 'string') {
    if (value instanceof Y.utils.CustomTypeDefinition) {
      Y[name] = value.parseArguments
    } else {
      Y[name] = value
    }
    if (requiringModules[name] != null) {
      requiringModules[name].resolve()
      delete requiringModules[name]
    }
  } else {
    for (var i = 0; i < arguments.length; i++) {
      var f = arguments[i]
      if (typeof f === 'function') {
        f(Y)
      } else {
        throw new Error('Expected function!')
      }
    }
  }
}

Y.requestModules = requestModules
function requestModules (modules) {
  var sourceDir
  if (Y.sourceDir === null) {
    sourceDir = null
  } else {
    sourceDir = Y.sourceDir || '/bower_components'
  }
  // determine if this module was compiled for es5 or es6 (y.js vs. y.es6)
  // if Insert.execute is a Function, then it isnt a generator..
  // then load the es5(.js) files..
  var extention = typeof regeneratorRuntime !== 'undefined' ? '.js' : '.es6'
  var promises = []
  for (var i = 0; i < modules.length; i++) {
    var module = modules[i].split('(')[0]
    var modulename = 'y-' + module.toLowerCase()
    if (Y[module] == null) {
      if (requiringModules[module] == null) {
        // module does not exist
        if (typeof window !== 'undefined' && window.Y !== 'undefined') {
          if (sourceDir != null) {
            var imported = document.createElement('script')
            imported.src = sourceDir + '/' + modulename + '/' + modulename + extention
            document.head.appendChild(imported)
          }
          let requireModule = {}
          requiringModules[module] = requireModule
          requireModule.promise = new Promise(function (resolve) {
            requireModule.resolve = resolve
          })
          promises.push(requireModule.promise)
        } else {
          console.info('YJS: Please do not depend on automatic requiring of modules anymore! Extend modules as follows `require(\'y-modulename\')(Y)`')
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

export default function Y (opts/* :YOptions */) /* :Promise<YConfig> */ {
  if (opts.hasOwnProperty('sourceDir')) {
    Y.sourceDir = opts.sourceDir
  }
  opts.types = opts.types != null ? opts.types : []
  var modules = [opts.db.name, opts.connector.name].concat(opts.types)
  for (var name in opts.share) {
    modules.push(opts.share[name])
  }
  return new Promise(function (resolve, reject) {
    if (opts == null) reject(new Error('An options object is expected!'))
    else if (opts.connector == null) reject(new Error('You must specify a connector! (missing connector property)'))
    else if (opts.connector.name == null) reject(new Error('You must specify connector name! (missing connector.name property)'))
    else if (opts.db == null) reject(new Error('You must specify a database! (missing db property)'))
    else if (opts.connector.name == null) reject(new Error('You must specify db name! (missing db.name property)'))
    else {
      opts = Y.utils.copyObject(opts)
      opts.connector = Y.utils.copyObject(opts.connector)
      opts.db = Y.utils.copyObject(opts.db)
      opts.share = Y.utils.copyObject(opts.share)
      Y.requestModules(modules).then(function () {
        var yconfig = new YConfig(opts)
        let resolved = false
        if (opts.timeout != null && opts.timeout >= 0) {
          setTimeout(function () {
            if (!resolved) {
              reject(new Error('Yjs init timeout'))
              yconfig.destroy()
            }
          }, opts.timeout)
        }
        yconfig.db.whenUserIdSet(function () {
          yconfig.init(function () {
            resolved = true
            resolve(yconfig)
          }, reject)
        })
      }).catch(reject)
    }
  })
}

class YConfig extends Y.utils.NamedEventHandler {
  /* ::
  db: Y.AbstractDatabase;
  connector: Y.AbstractConnector;
  share: {[key: string]: any};
  options: Object;
  */
  constructor (opts, callback) {
    super()
    this.options = opts
    this.db = new Y[opts.db.name](this, opts.db)
    this.connector = new Y[opts.connector.name](this, opts.connector)
    if (opts.persistence != null) {
      this.persistence = new Y[opts.persistence.name](this, opts.persistence)
    } else {
      this.persistence = null
    }
    this.connected = true
  }
  init (callback) {
    var opts = this.options
    var share = {}
    this.share = share
    this.db.requestTransaction(function * requestTransaction () {
      // create shared object
      for (var propertyname in opts.share) {
        var typeConstructor = opts.share[propertyname].split('(')
        let typeArgs = ''
        if (typeConstructor.length === 2) {
          typeArgs = typeConstructor[1].split(')')[0] || ''
        }
        var typeName = typeConstructor.splice(0, 1)
        var type = Y[typeName]
        var typedef = type.typeDefinition
        var id = [0xFFFFFF, typedef.struct + '_' + typeName + '_' + propertyname + '_' + typeArgs]
        let args = Y.utils.parseTypeDefinition(type, typeArgs)
        share[propertyname] = yield * this.store.initType.call(this, id, args)
      }
    })
    if (this.persistence != null) {
      this.persistence.retrieveContent()
        .then(() => this.db.whenTransactionsFinished())
        .then(callback)
    } else {
      this.db.whenTransactionsFinished()
        .then(callback)
    }
  }
  isConnected () {
    return this.connector.isSynced
  }
  disconnect () {
    if (this.connected) {
      this.connected = false
      return this.connector.disconnect()
    } else {
      return Promise.resolve()
    }
  }
  reconnect () {
    if (!this.connected) {
      this.connected = true
      return this.connector.reconnect()
    } else {
      return Promise.resolve()
    }
  }
  destroy () {
    var self = this
    return this.close().then(function () {
      if (self.db.deleteDB != null) {
        return self.db.deleteDB()
      } else {
        return Promise.resolve()
      }
    }).then(() => {
      // remove existing event listener
      super.destroy()
    })
  }
  close () {
    var self = this
    this.share = null
    if (this.connector.destroy != null) {
      this.connector.destroy()
    } else {
      this.connector.disconnect()
    }
    return this.db.whenTransactionsFinished().then(function () {
      self.db.destroyTypes()
      // make sure to wait for all transactions before destroying the db
      self.db.requestTransaction(function * () {
        yield * self.db.destroy()
      })
      return self.db.whenTransactionsFinished()
    })
  }
}
