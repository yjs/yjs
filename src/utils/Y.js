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
  Transaction, YEvent // eslint-disable-line
} from '../internals.js'

import { Observable } from 'lib0/observable.js'
import * as random from 'lib0/random.js'
import * as map from 'lib0/map.js'

/**
 * A Yjs instance handles the state of shared data.
 * @extends Observable<string>
 */
export class Y extends Observable {
  /**
   * @param {Object|undefined} conf configuration
   */
  constructor (conf = {}) {
    super()
    this.clientID = random.uint32()
    /**
     * @type {Map<string, AbstractType<YEvent>>}
     */
    this.share = new Map()
    this.store = new StructStore()
    /**
     * @type {Transaction | null}
     * @private
     */
    this._transaction = null
  }
  /**
   * Changes that happen inside of a transaction are bundled. This means that
   * the observer fires _after_ the transaction is finished and that all changes
   * that happened inside of the transaction are sent as one message to the
   * other peers.
   *
   * @param {function(Transaction):void} f The function that should be executed as a transaction
   *
   * @public
   */
  transact (f) {
    transact(this, f)
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
   * @param {Function} TypeConstructor The constructor of the type definition
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
        const t = new Constr()
        t._map = type._map
        t._start = type._start
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
   *
   * @protected
   */
  destroy () {
    this.emit('destroyed', [true])
    super.destroy()
  }
}
