import {
  diffIdSet,
  mergeIdSets,
  noAttributionsManager,
  AbstractAttributionManager, Item, AbstractType, Transaction, AbstractStruct // eslint-disable-line
} from '../internals.js'

import * as delta from 'lib0/delta' // eslint-disable-line

/**
 * @typedef {import('./types.js').YType} _YType
 */

/**
 * @template {AbstractType<any,any>} Target
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
     * @type {(Target extends AbstractType<infer D,any> ? D : delta.Delta<any,any,any,any,any>)|null}
     */
    this._delta = null
    /**
     * @type {(Target extends AbstractType<infer D,any> ? import('../internals.js').ToDeepEventDelta<D> : delta.Delta<any,any,any,any,any>)|null}
     */
    this._deltaDeep = null
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
   * @template {boolean} [Deep=false]
   * @param {AbstractAttributionManager} am
   * @param {object} [opts]
   * @param {Deep} [opts.deep]
   * @return {Target extends AbstractType<infer D,any> ? (Deep extends true ? import('../internals.js').ToDeepEventDelta<D> : D) : delta.Delta<any,any,any,any>} The Delta representation of this type.
   *
   * @public
   */
  getDelta (am = noAttributionsManager, { deep } = {}) {
    const itemsToRender = mergeIdSets([diffIdSet(this.transaction.insertSet, this.transaction.deleteSet), diffIdSet(this.transaction.deleteSet, this.transaction.insertSet)])
    const modified = deep ? this.transaction.changedParentTypes : null
    return /** @type {any} */ (this.target.getContent(am, { itemsToRender, retainDeletes: true, renderAttrs: this.keysChanged, renderChildren: deep || this.childListChanged, deletedItems: this.transaction.deleteSet, deep: !!deep, modified }))
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

  /**
   * Compute the changes in the delta format.
   * A {@link https://quilljs.com/docs/delta/|Quill Delta}) that represents the changes on the document.
   *
   * @type {Target extends AbstractType<infer D,any> ? D : delta.Delta<any,any,any,any,any>} The Delta representation of this type.
   * @public
   */
  get deltaDeep () {
    return /** @type {any} */ (this._deltaDeep ?? (this._deltaDeep = this.getDelta(noAttributionsManager, { deep: true })))
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
