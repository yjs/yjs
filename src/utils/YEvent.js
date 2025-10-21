import {
  diffIdSet,
  mergeIdSets,
  noAttributionsManager,
  AbstractAttributionManager, Item, AbstractType, Transaction, AbstractStruct // eslint-disable-line
} from '../internals.js'

import * as array from 'lib0/array'
import * as error from 'lib0/error'
import * as delta from 'lib0/delta' // eslint-disable-line

/**
 * @typedef {import('./types.js').YType} _YType
 */

const errorComputeChanges = 'You must not compute changes after the event-handler fired.'

/**
 * @template {_YType} Target
 * YEvent describes the changes on a YType.
 */
export class YEvent {
  /**
   * @param {Target} target The changed type.
   * @param {Transaction} transaction
   * @param {Set<any>?} subs The keys that changed
   */
  constructor (target, transaction, subs) {
    /**
     * The type on which this event was created on.
     * @type {Target}
     */
    this.target = target
    /**
     * The current target on which the observe callback is called.
     * @type {_YType}
     */
    this.currentTarget = target
    /**
     * The transaction that triggered this event.
     * @type {Transaction}
     */
    this.transaction = transaction
    /**
     * @type {null | Map<string, { action: 'add' | 'update' | 'delete', oldValue: any }>}
     */
    this._keys = null
    /**
     * @type {(Target extends AbstractType<infer D,any> ? D : delta.Delta<any,any,any,any,any>)|null}
     */
    this._delta = null
    /**
     * @type {Array<string|number>|null}
     */
    this._path = null
    /**
     * Whether the children changed.
     * @type {Boolean}
     * @private
     */
    this.childListChanged = false
    /**
     * Set of all changed attributes.
     * @type {Set<string>}
     */
    this.keysChanged = new Set()
    subs?.forEach((sub) => {
      if (sub === null) {
        this.childListChanged = true
      } else {
        this.keysChanged.add(sub)
      }
    })
  }

  /**
   * Computes the path from `y` to the changed type.
   *
   * @todo v14 should standardize on path: Array<{parent, index}> because that is easier to work with.
   *
   * The following property holds:
   * @example
   *   let type = y
   *   event.path.forEach(dir => {
   *     type = type.get(dir)
   *   })
   *   type === event.target // => true
   */
  get path () {
    return this._path || (this._path = getPathTo(this.currentTarget, this.target))
  }

  /**
   * Check if a struct is deleted by this event.
   *
   * In contrast to change.deleted, this method also returns true if the struct was added and then deleted.
   *
   * @param {AbstractStruct} struct
   * @return {boolean}
   */
  deletes (struct) {
    return this.transaction.deleteSet.hasId(struct.id)
  }

  /**
   * @type {Map<string, { action: 'add' | 'update' | 'delete', oldValue: any }>}
   */
  get keys () {
    if (this._keys === null) {
      if (this.transaction.doc._transactionCleanups.length === 0) {
        throw error.create(errorComputeChanges)
      }
      const keys = new Map()
      const target = this.target
      // @ts-ignore
      const changed = /** @type Set<string|null> */ (this.transaction.changed.get(target))
      changed.forEach(key => {
        if (key !== null) {
          const item = /** @type {Item} */ (target._map.get(key))
          /**
           * @type {'delete' | 'add' | 'update'}
           */
          let action
          let oldValue
          if (this.adds(item)) {
            let prev = item.left
            while (prev !== null && this.adds(prev)) {
              prev = prev.left
            }
            if (this.deletes(item)) {
              if (prev !== null && this.deletes(prev)) {
                action = 'delete'
                oldValue = array.last(prev.content.getContent())
              } else {
                return
              }
            } else {
              if (prev !== null && this.deletes(prev)) {
                action = 'update'
                oldValue = array.last(prev.content.getContent())
              } else {
                action = 'add'
                oldValue = undefined
              }
            }
          } else {
            if (this.deletes(item)) {
              action = 'delete'
              oldValue = array.last(/** @type {Item} */ item.content.getContent())
            } else {
              return // nop
            }
          }
          keys.set(key, { action, oldValue })
        }
      })
      this._keys = keys
    }
    return this._keys
  }

  /**
   * Check if a struct is added by this event.
   *
   * In contrast to change.deleted, this method also returns true if the struct was added and then deleted.
   *
   * @param {AbstractStruct} struct
   * @return {boolean}
   */
  adds (struct) {
    return this.transaction.insertSet.hasId(struct.id)
  }

  /**
   * @param {AbstractAttributionManager} am
   * @return {Target extends AbstractType<infer D,any> ? D : delta.Delta<any,any,any,any>} The Delta representation of this type.
   *
   * @public
   */
  getDelta (am = noAttributionsManager) {
    const itemsToRender = mergeIdSets([diffIdSet(this.transaction.insertSet, this.transaction.deleteSet), diffIdSet(this.transaction.deleteSet, this.transaction.insertSet)])
    return /** @type {any} */ (this.target.getContent(am, { itemsToRender, retainDeletes: true, renderAttrs: this.keysChanged, renderChildren: this.childListChanged, deletedItems: this.transaction.deleteSet }))
  }

  /**
   * Compute the changes in the delta format.
   * A {@link https://quilljs.com/docs/delta/|Quill Delta}) that represents the changes on the document.
   *
   * @type {Target extends AbstractType<infer D,any> ? D : delta.Delta<any,any,any,any,any>} The Delta representation of this type.
   * @public
   */
  get delta () {
    return /** @type {any} */ (this._delta ?? (this._delta = this.getDelta()))
  }
}

/**
 * Compute the path from this type to the specified target.
 *
 * @example
 *   // `child` should be accessible via `type.get(path[0]).get(path[1])..`
 *   const path = type.getPathTo(child)
 *   // assuming `type instanceof YArray`
 *   console.log(path) // might look like => [2, 'key1']
 *   child === type.get(path[0]).get(path[1])
 *
 * @param {_YType} parent
 * @param {_YType} child target
 * @return {Array<string|number>} Path to the target
 *
 * @private
 * @function
 */
const getPathTo = (parent, child) => {
  const path = []
  while (child._item !== null && child !== parent) {
    if (child._item.parentSub !== null) {
      // parent is map-ish
      path.unshift(child._item.parentSub)
    } else {
      // parent is array-ish
      let i = 0
      let c = /** @type {import('../utils/types.js').YType} */ (child._item.parent)._start
      while (c !== child._item && c !== null) {
        if (!c.deleted && c.countable) {
          i += c.length
        }
        c = c.right
      }
      path.unshift(i)
    }
    child = /** @type {_YType} */ (child._item.parent)
  }
  return path
}
