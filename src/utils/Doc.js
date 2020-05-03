/**
 * @module Y
 */

import {
  StructStore,
  AbstractType,
  YArray,
  YText,
  YMap,
  YXmlFragment,
  transact,
  Item, Transaction, YEvent // eslint-disable-line
} from '../internals.js'

import { Observable } from 'lib0/observable.js'
import * as random from 'lib0/random.js'
import * as map from 'lib0/map.js'

export const generateNewClientId = random.uint32

/**
 * A Yjs instance handles the state of shared data.
 * @extends Observable<string>
 */
export class Doc extends Observable {
  /**
   * @param {Object} conf configuration
   * @param {boolean} [conf.gc] Disable garbage collection (default: gc=true)
   * @param {function(Item):boolean} [conf.gcFilter] Will be called before an Item is garbage collected. Return false to keep the Item.
   */
  constructor ({ gc = true, gcFilter = () => true } = {}) {
    super()
    this.gc = gc
    this.gcFilter = gcFilter
    this.clientID = generateNewClientId()
    /**
     * @type {Map<string, AbstractType<YEvent>>}
     */
    this.share = new Map()
    this.store = new StructStore()
    /**
     * @type {Transaction | null}
     */
    this._transaction = null
    /**
     * @type {Array<Transaction>}
     */
    this._transactionCleanups = []
  }

  /**
   * Changes that happen inside of a transaction are bundled. This means that
   * the observer fires _after_ the transaction is finished and that all changes
   * that happened inside of the transaction are sent as one message to the
   * other peers.
   *
   * @param {function(Transaction):void} f The function that should be executed as a transaction
   * @param {any} [origin] Origin of who started the transaction. Will be stored on transaction.origin
   *
   * @public
   */
  transact (f, origin = null) {
    transact(this, f, origin)
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
   * @param {string} name
   * @param {Function} TypeConstructor The constructor of the type definition. E.g. Y.Text, Y.Array, Y.Map, ...
   * @return {AbstractType<any>} The created type. Constructed with TypeConstructor
   *
   * @public
   */
  get (name, TypeConstructor = AbstractType) {
    const type = map.setIfUndefined(this.share, name, () => {
      // @ts-ignore
      const t = new TypeConstructor()
      t._integrate(this, null)
      return t
    })
    const Constr = type.constructor
    if (TypeConstructor !== AbstractType && Constr !== TypeConstructor) {
      if (Constr === AbstractType) {
        // @ts-ignore
        const t = new TypeConstructor()
        t._map = type._map
        type._map.forEach(/** @param {Item?} n */ n => {
          for (; n !== null; n = n.left) {
            // @ts-ignore
            n.parent = t
          }
        })
        t._start = type._start
        for (let n = t._start; n !== null; n = n.right) {
          n.parent = t
        }
        t._length = type._length
        this.share.set(name, t)
        t._integrate(this, null)
        return t
      } else {
        throw new Error(`Type with the name ${name} has already been defined with a different constructor`)
      }
    }
    return type
  }

  /**
   * @template T
   * @param {string} name
   * @return {YArray<T>}
   *
   * @public
   */
  getArray (name) {
    // @ts-ignore
    return this.get(name, YArray)
  }

  /**
   * @param {string} name
   * @return {YText}
   *
   * @public
   */
  getText (name) {
    // @ts-ignore
    return this.get(name, YText)
  }

  /**
   * @param {string} name
   * @return {YMap<any>}
   *
   * @public
   */
  getMap (name) {
    // @ts-ignore
    return this.get(name, YMap)
  }

  /**
   * @param {string} name
   * @return {YXmlFragment}
   *
   * @public
   */
  getXmlFragment (name) {
    // @ts-ignore
    return this.get(name, YXmlFragment)
  }

  /**
   * Emit `destroy` event and unregister all event handlers.
   */
  destroy () {
    this.emit('destroyed', [true])
    super.destroy()
  }

  /**
   * @param {string} eventName
   * @param {function} f
   */
  on (eventName, f) {
    super.on(eventName, f)
  }

  /**
   * @param {string} eventName
   * @param {function} f
   */
  off (eventName, f) {
    super.off(eventName, f)
  }
}
