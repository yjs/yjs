import {
  diffIdSet,
  mergeIdSets,
  noAttributionsManager,
  YType, Doc, AbstractAttributionManager, Item, Transaction, AbstractStruct, // eslint-disable-line
  createAbsolutePositionFromRelativePosition,
  createRelativePosition,
  AbsolutePosition
} from '../internals.js'

import * as map from 'lib0/map'
import * as delta from 'lib0/delta' // eslint-disable-line
import * as set from 'lib0/set'

/**
 * @template {delta.DeltaConf} DConf
 * YEvent describes the changes on a YType.
 */
export class YEvent {
  /**
   * @param {YType<DConf>} target The changed type.
   * @param {Transaction} transaction
   * @param {Set<any>?} subs The keys that changed
   */
  constructor (target, transaction, subs) {
    /**
     * The type on which this event was created on.
     * @type {YType<DConf>}
     */
    this.target = target
    /**
     * The current target on which the observe callback is called.
     * @type {YType<any>}
     */
    this.currentTarget = target
    /**
     * The transaction that triggered this event.
     * @type {Transaction}
     */
    this.transaction = transaction
    /**
     * @type {import('../ytype.js').DeltaConfTypesToDelta<DConf>|null}
     */
    this._delta = null
    /**
     * @type {delta.Delta<DConf>|null}
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
   * @return {Deep extends true ? delta.Delta<import('../internals.js').DeltaConfTypesToDelta<DConf>> : delta.Delta<DConf>} The Delta representation of this type.
   *
   * @public
   */
  getDelta (am = noAttributionsManager, { deep } = {}) {
    const itemsToRender = mergeIdSets([diffIdSet(this.transaction.insertSet, this.transaction.deleteSet), diffIdSet(this.transaction.deleteSet, this.transaction.insertSet)])
    /**
     * @todo this should be done only one in the transaction step
     *
     * @type {Map<YType,Set<string|null>>|null}
     */
    let modified = this.transaction.changed
    if (deep) {
      // need to add deep changes to copy of modified
      const dchanged = new Map()
      modified.forEach((attrs, type) => {
        dchanged.set(type, new Set(attrs))
      })
      for (let m of modified.keys()) {
        while (m._item != null) {
          const item = m._item
          const ms = map.setIfUndefined(dchanged, item?.parent, set.create)
          if (item && !ms.has(item.parentSub)) {
            ms.add(item.parentSub)
            m = /** @type {any} */ (item.parent)
          } else {
            break
          }
        }
      }
      modified = dchanged
    }
    return /** @type {any} */ (this.target.getContent(am, { itemsToRender, retainDeletes: true, deletedItems: this.transaction.deleteSet, deep: !!deep, modified }))
  }

  /**
   * Compute the changes in the delta format.
   * A {@link https://quilljs.com/docs/delta/|Quill Delta}) that represents the changes on the document.
   *
   * @type {delta.Delta<DConf>} The Delta representation of this type.
   * @public
   */
  get delta () {
    return /** @type {any} */ (this._delta ?? (this._delta = this.getDelta().done()))
  }

  /**
   * Compute the changes in the delta format.
   * A {@link https://quilljs.com/docs/delta/|Quill Delta}) that represents the changes on the document.
   *
   * @type {import('../internals.js').DeltaConfTypesToDeltaDelta<DConf>} The Delta representation of this type.
   * @public
   */
  get deltaDeep () {
    return /** @type {any} */ (this._deltaDeep ?? (this._deltaDeep = /** @type {any} */ (this.getDelta(noAttributionsManager, { deep: true }))))
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
 * @param {YType} parent
 * @param {YType} child target
 * @param {AbstractAttributionManager} am
 * @return {Array<string|number>} Path to the target
 *
 * @private
 * @function
 */
export const getPathTo = (parent, child, am = noAttributionsManager) => {
  const path = []
  const doc = /** @type {Doc} */ (parent.doc)
  while (child._item !== null && child !== parent) {
    if (child._item.parentSub !== null) {
      // parent is map-ish
      path.unshift(child._item.parentSub)
    } else {
      const parent = /** @type {import('../utils/types.js').YType} */ (child._item.parent)
      // parent is array-ish
      const apos = /** @type {AbsolutePosition} */ (createAbsolutePositionFromRelativePosition(createRelativePosition(parent, child._item.id), doc, false, am))
      path.unshift(apos.index)
    }
    child = /** @type {YType} */ (child._item.parent)
  }
  return path
}
