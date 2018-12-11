import { DeleteStore } from './DeleteStore.js'
import { OperationStore } from './OperationStore.js'
import { StateStore } from './StateStore.js'
import { generateRandomUint32 } from './generateRandomUint32.js'
import { createRootID } from './ID.js'
import { NamedEventHandler } from '../lib/NamedEventHandler.js'
import { Transaction } from './Transaction.js'
import * as encoding from '../lib/encoding.js'
import * as message from '../protocols/sync.js'
import { integrateRemoteStructs } from './integrateRemoteStructs.js'
import { Type } from '../structs/Type.js' // eslint-disable-line
import { Decoder } from '../lib/decoding.js' // eslint-disable-line

/**
 * Anything that can be encoded with `JSON.stringify` and can be decoded with
 * `JSON.parse`.
 *
 * The following property should hold:
 * `JSON.parse(JSON.stringify(key))===key`
 *
 * At the moment the only safe values are number and string.
 *
 * @typedef {(number|string|Object)} encodable
 */

/**
 * A Yjs instance handles the state of shared data.
 */
export class Y extends NamedEventHandler {
  /**
   * @param {Object} [conf] configuration
   */
  constructor (conf = {}) {
    super()
    this.gcEnabled = conf.gc || false
    this._contentReady = false
    this.userID = generateRandomUint32()
    // TODO: This should be a Map so we can use encodables as keys
    this._map = new Map()
    this.ds = new DeleteStore()
    this.os = new OperationStore(this)
    this.ss = new StateStore(this)
    this._missingStructs = new Map()
    this._readyToIntegrate = []
    this._transaction = null
    this.connected = false
    // for compatibility with isParentOf
    this._parent = null
    this._hasUndoManager = false
    this._deleted = false // for compatiblity of having this as a parent for types
    this._id = null
  }

  /**
   * Read the Decoder and fill the Yjs instance with data in the decoder.
   *
   * @param {Decoder} decoder The BinaryDecoder to read from.
   */
  importModel (decoder) {
    this.transact(() => {
      integrateRemoteStructs(decoder, this)
      message.readDeleteSet(decoder, this)
    })
  }

  /**
   * Encode the Yjs model to ArrayBuffer
   *
   * @return {ArrayBuffer} The Yjs model as ArrayBuffer
   */
  exportModel () {
    const encoder = encoding.createEncoder()
    message.writeStructs(encoder, this, new Map())
    message.writeDeleteSet(encoder, this)
    return encoding.toBuffer(encoder)
  }
  _beforeChange () {}
  _callObserver (transaction, subs, remote) {}
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
      transaction.changedTypes.forEach((subs, type) => {
        if (!type._deleted) {
          type._callObserver(transaction, subs, remote)
        }
      })
      transaction.changedParentTypes.forEach((events, type) => {
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
   * Fake _start for root properties (y.set('name', type))
   *
   * @private
   */
  get _start () {
    return null
  }

  /**
   * Fake _start for root properties (y.set('name', type))
   *
   * @private
   */
  set _start (start) {}

  /**
   * Define a shared data type.
   *
   * Multiple calls of `y.define(name, TypeConstructor)` yield the same result
   * and do not overwrite each other. I.e.
   * `y.define(name, type) === y.define(name, type)`
   *
   * After this method is called, the type is also available on `y._map.get(name)`.
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
   *   // .. when accessing the type use y._map.get(name)
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
   * @param {Function} TypeConstructor The constructor of the type definition
   * @returns {Type} The created type. Constructed with TypeConstructor
   */
  define (name, TypeConstructor) {
    let id = createRootID(name, TypeConstructor)
    let type = this.os.get(id)
    if (this._map.get(name) === undefined) {
      this._map.set(name, type)
    } else if (this._map.get(name) !== type) {
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
    return this._map.get(name)
  }

  /**
   * Disconnect from the room, and destroy all traces of this Yjs instance.
   */
  destroy () {
    this.emit('destroyed', true)
    super.destroy()
    this._map = null
    this.os = null
    this.ds = null
    this.ss = null
  }
}
