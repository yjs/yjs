import { createInsertSetFromStructStore, createDeleteSetFromStructStore, diffIdSet, mergeIdSets, iterateStructsByIdSet } from './IdSet.js'
import { createAttributionManagerFromDiff } from './AttributionManager.js'
import { Item } from '../structs/Item.js'

import * as delta from 'lib0/delta'
import * as map from 'lib0/map'
import * as set from 'lib0/set'

/**
 * @param {import('./Doc.js').Doc} v1
 * @param {import('./Doc.js').Doc} v2
 * @return {delta.DeltaBuilderAny}
 */
export const diffDocsToDelta = (v1, v2, { am = createAttributionManagerFromDiff(v1, v2) } = {}) => {
  const d = delta.create()
  v2.transact(tr => {
    v2.share.forEach((type, typename) => {
      const insertDiff = diffIdSet(createInsertSetFromStructStore(v2.store, false), createInsertSetFromStructStore(v1.store, false))
      const deleteDiff = diffIdSet(createDeleteSetFromStructStore(v2.store), createDeleteSetFromStructStore(v1.store))
      // don't render items that have been inserted and then deleted
      const insertsOnly = diffIdSet(insertDiff, deleteDiff)
      const deletesOnly = diffIdSet(deleteDiff, insertDiff)
      const itemsToRender = mergeIdSets([insertsOnly, deleteDiff])
      /**
       * @type {Map<import('../ytype.js').YType, Set<string|null>>}
       */
      const changedTypes = new Map()
      iterateStructsByIdSet(tr, itemsToRender, /** @param {any} item */ item => {
        while (item instanceof Item) {
          const parent = /** @type {import('../ytype.js').YType} */ (item.parent)
          const conf = map.setIfUndefined(changedTypes, parent, set.create)
          if (conf.has(item.parentSub)) break // has already been marked as modified
          conf.add(item.parentSub)
          item = parent._item
        }
      })
      const typeConf = changedTypes.get(type)
      if (typeConf) {
        // @ts-ignore
        const shareDelta = type.toDelta(am, {
          itemsToRender, retainDeletes: true, deletedItems: deletesOnly, modified: changedTypes, deep: true
        })
        d.modifyAttr(typename, shareDelta)
      }
    })
  })
  return d
}
