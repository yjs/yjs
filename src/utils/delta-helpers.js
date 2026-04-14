import * as delta from 'lib0/delta'
import { createInsertSetFromStructStore, createDeleteSetFromStructStore, diffIdSet, mergeIdSets } from './ids.js'
import { createAttributionManagerFromDiff } from './AttributionManager.js'
import { computeModifiedFromItems } from '../ytype.js'

/**
 * @param {Doc} v1
 * @param {Doc} v2
 * @return {delta.DeltaBuilderAny}
 */
export const diffDocsToDelta = (v1, v2, { am = createAttributionManagerFromDiff(v1, v2) } = {}) => {
  const insertDiff = diffIdSet(createInsertSetFromStructStore(v2.store, false), createInsertSetFromStructStore(v1.store, false))
  const deleteDiff = diffIdSet(createDeleteSetFromStructStore(v2.store), createDeleteSetFromStructStore(v1.store))
  // don't render items that have been inserted and then deleted
  const insertsOnly = diffIdSet(insertDiff, deleteDiff)
  const deletesOnly = diffIdSet(deleteDiff, insertDiff)
  const itemsToRender = mergeIdSets([insertsOnly, deleteDiff])
  /**
   * @type {Map<YType, Set<string|null>>}
   */
  const changedTypes = computeModifiedFromItems(v2.store, itemsToRender)
  const d = delta.create()
  v2.share.forEach((type, typename) => {
    const typeConf = changedTypes.get(type)
    if (typeConf) {
      const shareDelta = type.toDelta(am, {
        itemsToRender, retainDeletes: true, deletedItems: deletesOnly, modified: changedTypes, deep: true
      })
      d.modifyAttr(typename, shareDelta)
    }
  })
  return d
}
