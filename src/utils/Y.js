import { StructStore, findIndexSS } from './StructStore.js'
import * as random from 'lib0/random.js'
import * as map from 'lib0/map.js'
import { Observable } from 'lib0/observable.js'
import { Transaction } from './Transaction.js'
import { AbstractStruct, AbstractRef } from '../structs/AbstractStruct.js' // eslint-disable-line
import { AbstractType } from '../types/AbstractType.js'
import { AbstractItem } from '../structs/AbstractItem.js'
import { sortAndMergeDeleteSet } from './DeleteSet.js'
import * as math from 'lib0/math.js'
import { GC } from '../structs/GC.js' // eslint-disable-line
import { ItemDeleted } from '../structs/ItemDeleted.js' // eslint-disable-line
import { YArray } from '../types/YArray.js'
import { YText } from '../types/YText.js'
import { YMap } from '../types/YMap.js'
import { YXmlFragment } from '../types/YXmlElement.js'
import { YEvent } from './YEvent.js' // eslint-disable-line

/**
 * A Yjs instance handles the state of shared data.
 * @extends Observable<string>
 */
export class Y extends Observable {
  /**
   * @param {Object} [conf] configuration
   */
  constructor (conf = {}) {
    super()
    this.gcEnabled = conf.gc || false
    this.clientID = random.uint32()
    /**
     * @type {Map<string, AbstractType<YEvent>>}
     */
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
   * @param {function(Transaction):void} f The function that should be executed as a transaction
   */
  transact (f) {
    let initialCall = false
    if (this._transaction === null) {
      initialCall = true
      this._transaction = new Transaction(this)
      this.emit('beforeTransaction', [this, this._transaction])
    }
    try {
      f(this._transaction)
    } catch (e) {
      console.error(e)
    }
    if (initialCall) {
      const transaction = this._transaction
      this._transaction = null
      // only call event listeners / observers if anything changed
      const transactionChangedContent = transaction.changedParentTypes.size !== 0
      if (transactionChangedContent) {
        this.emit('beforeObserverCalls', [this, this._transaction])
        // emit change events on changed types
        transaction.changed.forEach((subs, itemtype) => {
          itemtype._callObserver(transaction, subs)
        })
        transaction.changedParentTypes.forEach((events, type) => {
          events = events
            .filter(event =>
              event.target._item === null || !event.target._item.deleted
            )
          events
            .forEach(event => {
              event.currentTarget = type
            })
          // we don't have to check for events.length
          // because there is no way events is empty..
          type._deepEventHandler.callEventListeners(transaction, events)
        })
        // when all changes & events are processed, emit afterTransaction event
        this.emit('afterTransaction', [this, transaction])
        // transaction cleanup
        const store = transaction.y.store
        const ds = transaction.deleteSet
        // replace deleted items with ItemDeleted / GC
        sortAndMergeDeleteSet(ds)
        /**
         * @type {Set<ItemDeleted|GC>}
         */
        const replacedItems = new Set()
        for (const [client, deleteItems] of ds.clients) {
          /**
           * @type {Array<AbstractStruct>}
           */
          // @ts-ignore
          const structs = store.clients.get(client)
          for (let di = 0; di < deleteItems.length; di++) {
            const deleteItem = deleteItems[di]
            for (let si = findIndexSS(structs, deleteItem.clock); si < structs.length; si++) {
              const struct = structs[si]
              if (deleteItem.clock + deleteItem.len < struct.id.clock) {
                break
              }
              if (struct.deleted && struct instanceof AbstractItem) {
                // check if we can GC
                replacedItems.add(struct.gc(this))
              }
            }
          }
        }
        /**
         * @param {Array<AbstractStruct>} structs
         * @param {number} pos
         */
        const tryToMergeWithLeft = (structs, pos) => {
          const left = structs[pos - 1]
          const right = structs[pos]
          if (left.deleted === right.deleted && left.constructor === right.constructor) {
            if (left.mergeWith(right)) {
              structs.splice(pos, 1)
            }
          }
        }
        // on all affected store.clients props, try to merge
        for (const [client, clock] of transaction.stateUpdates) {
          /**
           * @type {Array<AbstractStruct>}
           */
          // @ts-ignore
          const structs = store.clients.get(client)
          // we iterate from right to left so we can safely remove entries
          for (let i = structs.length - 1; i >= math.max(findIndexSS(structs, clock), 1); i--) {
            tryToMergeWithLeft(structs, i)
          }
        }
        // try to merge replacedItems
        for (const replacedItem of replacedItems) {
          const id = replacedItem.id
          const client = id.client
          const clock = id.clock
          /**
           * @type {Array<AbstractStruct>}
           */
          // @ts-ignore
          const structs = store.clients.get(client)
          const replacedStructPos = findIndexSS(structs, clock)
          if (replacedStructPos + 1 < structs.length) {
            tryToMergeWithLeft(structs, replacedStructPos + 1)
          }
          if (replacedStructPos > 0) {
            tryToMergeWithLeft(structs, replacedStructPos)
          }
        }
        this.emit('afterTransactionCleanup', [this, transaction])
      }
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
   * @TODO: Decide wether to use define() or get() and then use it consistently
   *
   * @param {string} name
   * @param {Function} TypeConstructor The constructor of the type definition
   * @return {AbstractType<any>} The created type. Constructed with TypeConstructor
   */
  get (name, TypeConstructor = AbstractType) {
    // @ts-ignore
    const type = map.setIfUndefined(this.share, name, () => new TypeConstructor())
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
   * @template T
   * @param {string} name
   * @return {YArray<T>}
   */
  getArray (name) {
    // @ts-ignore
    return this.get(name, YArray)
  }
  /**
   * @param {string} name
   * @return {YText}
   */
  getText (name) {
    // @ts-ignore
    return this.get(name, YText)
  }
  /**
   * @param {string} name
   * @return {YMap<any>}
   */
  getMap (name) {
    // @ts-ignore
    return this.get(name, YMap)
  }
  /**
   * @param {string} name
   * @return {YXmlFragment}
   */
  getXmlFragment (name) {
    // @ts-ignore
    return this.get(name, YXmlFragment)
  }
  /**
   * Disconnect from the room, and destroy all traces of this Yjs instance.
   */
  destroy () {
    this.emit('destroyed', [true])
    super.destroy()
  }
}
