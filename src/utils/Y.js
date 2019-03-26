import { DeleteStore } from './DeleteSet.js/index.js' // TODO: remove
import { OperationStore } from './OperationStore.js'
import { StateStore } from './StateStore.js'
import { StructStore } from './StructStore.js'
import * as random from 'lib0/random.js'
import * as map from 'lib0/map.js'
import { Observable } from 'lib0/observable.js'
import { Transaction } from './Transaction.js'
import { AbstractStruct, AbstractRef } from '../structs/AbstractStruct.js' // eslint-disable-line
import { AbstractType } from '../types/AbstractType.js'
import { YArray } from '../types/YArray.js'

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
export class Y extends Observable {
  /**
   * @param {Object} [conf] configuration
   */
  constructor (conf = {}) {
    super()
    this.gcEnabled = conf.gc || false
    this.clientID = random.uint32()
    this.share = new Map()
    this.store = new StructStore()
    /**
     * @type {Map<number, Map<number, AbstractRef>>}
     */
    this._missingStructs = new Map()
    /**
     * @type {Array<AbstractStruct>}
     */
    this._readyToIntegrate = []
    /**
     * @type {Transaction | null}
     */
    this._transaction = null
    this._hasUndoManager = false
  }
  /**
   * @type {Transaction}
   */
  get transaction () {
    const t = this._transaction
    if (t === null) {
      throw new Error('All changes must happen inside a transaction')
    }
    return t
  }
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
    let initialCall = false
    if (this._transaction === null) {
      initialCall = true
      this._transaction = new Transaction(this)
      this.emit('beforeTransaction', [this, this._transaction, remote])
    }
    try {
      f(this)
    } catch (e) {
      console.error(e)
    }
    if (initialCall) {
      this.emit('beforeObserverCalls', [this, this._transaction, remote])
      const transaction = this._transaction
      this._transaction = null
      // emit change events on changed types
      transaction.changed.forEach((subs, itemtype) => {
        if (!itemtype._deleted) {
          itemtype.type._callObserver(transaction, subs, remote)
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
          type.type._deepEventHandler.callEventListeners(transaction, events)
        }
      })
      // when all changes & events are processed, emit afterTransaction event
      this.emit('afterTransaction', [this, transaction, remote])
    }
  }
  /**
   * Define a shared data type.
   *
   * Multiple calls of `y.get(name, TypeConstructor)` yield the same result
   * and do not overwrite each other. I.e.
   * `y.define(name, Y.Array) === y.define(name, Y.Array)`
   *
   * After this method is called, the type is also available on `y.share.get(name)`.
   *
   * *Best Practices:*
   * Define all types right after the Yjs instance is created and store them in a separate object.
   * Also use the typed methods `getText(name)`, `getArray(name)`, ..
   *
   * @example
   *   const y = new Y(..)
   *   const appState = {
   *     document: y.getText('document')
   *     comments: y.getArray('comments')
   *   }
   *
   * @TODO: implement getText, getArray, ..
   *
   * @param {string} name
   * @param {Function} TypeConstructor The constructor of the type definition
   * @return {AbstractType} The created type. Constructed with TypeConstructor
   */
  get (name, TypeConstructor = AbstractType) {
    // @ts-ignore
    const type = map.setTfUndefined(this.share, name, () => new TypeConstructor())
    const Constr = type.constructor
    if (Constr !== TypeConstructor) {
      if (Constr === AbstractType) {
        const t = new Constr()
        t._map = type._map
        t._start = type._start
        t._length = type._length
        this.share.set(name, t)
        return t
      } else {
        throw new Error(`Type with the name ${name} has already been defined with a different constructor`)
      }
    }
    return type
  }
  /**
   * Disconnect from the room, and destroy all traces of this Yjs instance.
   */
  destroy () {
    this.emit('destroyed', [true])
    super.destroy()
  }
}
