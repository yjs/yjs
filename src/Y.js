import DeleteStore from './Store/DeleteStore.js'
import OperationStore from './Store/OperationStore.js'
import StateStore from './Store/StateStore.js'
import { generateRandomUint32 } from './Util/generateRandomUint32.js'
import RootID from './Util/ID/RootID.js'
import NamedEventHandler from './Util/NamedEventHandler.js'
import Transaction from './Transaction.js'

export { default as DomBinding } from './Bindings/DomBinding/DomBinding.js'

/**
 * Anything that can be encoded with `JSON.stringify` and can be decoded with
 * `JSON.parse`.
 *
 * The following property should hold:
 * `JSON.parse(JSON.stringify(key))===key`
 *
 * At the moment the only safe values are number and string.
 *
 * @typedef {(number|string)} encodable
 */

/**
 * A Yjs instance handles the state of shared data.
 *
 * @param {string} room Users in the same room share the same content
 * @param {Object} opts Connector definition
 * @param {AbstractPersistence} persistence Persistence adapter instance
 */
export default class Y extends NamedEventHandler {
  constructor (room, opts, persistence, conf = {}) {
    super()
    this.gcEnabled = conf.gc || false
    /**
     * The room name that this Yjs instance connects to.
     * @type {String}
     */
    this.room = room
    if (opts != null && opts.connector != null) {
      opts.connector.room = room
    }
    this._contentReady = false
    this._opts = opts
    if (opts == null || typeof opts.userID !== 'number') {
      this.userID = generateRandomUint32()
    } else {
      this.userID = opts.userID
    }
    // TODO: This should be a Map so we can use encodables as keys
    this.share = {}
    this.ds = new DeleteStore(this)
    this.os = new OperationStore(this)
    this.ss = new StateStore(this)
    this._missingStructs = new Map()
    this._readyToIntegrate = []
    this._transaction = null
    /**
     * The {@link AbstractConnector}.that is used by this Yjs instance.
     * @type {AbstractConnector}
     */
    this.connector = null
    this.connected = false
    let initConnection = () => {
      if (opts != null) {
        this.connector = new Y[opts.connector.name](this, opts.connector)
        this.connected = true
        this.emit('connectorReady')
      }
    }
    /**
     * The {@link AbstractPersistence} that is used by this Yjs instance.
     * @type {AbstractPersistence}
     */
    this.persistence = null
    if (persistence != null) {
      this.persistence = persistence
      persistence._init(this).then(initConnection)
    } else {
      initConnection()
    }
    // for compatibility with isParentOf
    this._parent = null
    this._hasUndoManager = false
  }
  _setContentReady () {
    if (!this._contentReady) {
      this._contentReady = true
      this.emit('content')
    }
  }
  whenContentReady () {
    if (this._contentReady) {
      return Promise.resolve()
    } else {
      return new Promise(resolve => {
        this.once('content', resolve)
      })
    }
  }
  _beforeChange () {}
  /**
   * Changes that happen inside of a transaction are bundled. This means that
   * the observer fires _after_ the transaction is finished and that all changes
   * that happened inside of the transaction are sent as one message to the
   * other peers.
   *
   * @param {Function} f The function that should be executed as a transaction
   * @param {?Boolean} remote Optional. Whether this transaction is initiated by
   *                          a remote peer. This should not be set manually!
   *                          Defaults to false.
   */
  transact (f, remote = false) {
    let initialCall = this._transaction === null
    if (initialCall) {
      this._transaction = new Transaction(this)
      this.emit('beforeTransaction', this, this._transaction, remote)
    }
    try {
      f(this)
    } catch (e) {
      console.error(e)
    }
    if (initialCall) {
      this.emit('beforeObserverCalls', this, this._transaction, remote)
      const transaction = this._transaction
      this._transaction = null
      // emit change events on changed types
      transaction.changedTypes.forEach(function (subs, type) {
        if (!type._deleted) {
          type._callObserver(transaction, subs, remote)
        }
      })
      transaction.changedParentTypes.forEach(function (events, type) {
        if (!type._deleted) {
          events = events
            .filter(event =>
              !event.target._deleted
            )
          events
            .forEach(event => {
              event.currentTarget = type
            })
          // we don't have to check for events.length
          // because there is no way events is empty..
          type._deepEventHandler.callEventListeners(transaction, events)
        }
      })
      // when all changes & events are processed, emit afterTransaction event
      this.emit('afterTransaction', this, transaction, remote)
    }
  }

  /**
   * @private
   * Fake _start for root properties (y.set('name', type))
   */
  get _start () {
    return null
  }

  /**
   * @private
   * Fake _start for root properties (y.set('name', type))
   */
  set _start (start) {
    return null
  }

  /**
   * Define a shared data type.
   *
   * Multiple calls of `y.define(name, TypeConstructor)` yield the same result
   * and do not overwrite each other. I.e.
   * `y.define(name, type) === y.define(name, type)`
   *
   * After this method is called, the type is also available on `y.share[name]`.
   *
   * *Best Practices:*
   * Either define all types right after the Yjs instance is created or always
   * use `y.define(..)` when accessing a type.
   *
   * @example
   *   // Option 1
   *   const y = new Y(..)
   *   y.define('myArray', YArray)
   *   y.define('myMap', YMap)
   *   // .. when accessing the type use y.share[name]
   *   y.share.myArray.insert(..)
   *   y.share.myMap.set(..)
   *
   *   // Option2
   *   const y = new Y(..)
   *   // .. when accessing the type use `y.define(..)`
   *   y.define('myArray', YArray).insert(..)
   *   y.define('myMap', YMap).set(..)
   *
   * @param {String} name
   * @param {YType Constructor} TypeConstructor The constructor of the type definition
   * @returns {YType} The created type
   */
  define (name, TypeConstructor) {
    let id = new RootID(name, TypeConstructor)
    let type = this.os.get(id)
    if (this.share[name] === undefined) {
      this.share[name] = type
    } else if (this.share[name] !== type) {
      throw new Error('Type is already defined with a different constructor')
    }
    return type
  }

  /**
   * Get a defined type. The type must be defined locally. First define the
   * type with {@link define}.
   *
   * This returns the same value as `y.share[name]`
   *
   * @param {String} name The typename
   */
  get (name) {
    return this.share[name]
  }

  /**
   * Disconnect this Yjs Instance from the network. The connector will
   * unsubscribe from the room and document updates are not shared anymore.
   */
  disconnect () {
    if (this.connected) {
      this.connected = false
      return this.connector.disconnect()
    } else {
      return Promise.resolve()
    }
  }

  /**
   * If disconnected, tell the connector to reconnect to the room.
   */
  reconnect () {
    if (!this.connected) {
      this.connected = true
      return this.connector.reconnect()
    } else {
      return Promise.resolve()
    }
  }

  /**
   * Disconnect from the room, and destroy all traces of this Yjs instance.
   * Persisted data will remain until removed by the persistence adapter.
   */
  destroy () {
    super.destroy()
    this.share = null
    if (this.connector != null) {
      if (this.connector.destroy != null) {
        this.connector.destroy()
      } else {
        this.connector.disconnect()
      }
    }
    if (this.persistence !== null) {
      this.persistence.deinit(this)
      this.persistence = null
    }
    this.os = null
    this.ds = null
    this.ss = null
  }
}

Y.extend = function extendYjs () {
  for (var i = 0; i < arguments.length; i++) {
    var f = arguments[i]
    if (typeof f === 'function') {
      f(Y)
    } else {
      throw new Error('Expected a function!')
    }
  }
}
