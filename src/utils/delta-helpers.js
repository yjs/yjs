import * as delta from 'lib0/delta'
import { createInsertSetFromStructStore, createDeleteSetFromStructStore, diffIdSet, mergeIdSets } from './ids.js'
import { createDiffRenderer } from './Renderer.js'
import { computeModifiedFromItems } from '../ynode.js'

/**
 * @param {Doc} v1
 * @param {Doc} v2
 * @param {{ renderer?: AbstractRenderer? }} [opts] - `renderer` defaults to a diff renderer of the two docs; `null` renders the plain change
 * @return {delta.DeltaBuilderAny}
 */
export const diffDocsToDelta = (v1, v2, { renderer = createDiffRenderer(v1, v2) } = {}) => {
  const insertDiff = diffIdSet(createInsertSetFromStructStore(v2.store, false), createInsertSetFromStructStore(v1.store, false))
  const deleteDiff = diffIdSet(createDeleteSetFromStructStore(v2.store), createDeleteSetFromStructStore(v1.store))
  // churn — inserted *and* deleted between the docs — is left out on both sides: v1 never held it,
  // so neither an insert nor a delete of it belongs in the change (as `YEvent.getDelta` does)
  const itemsToRender = mergeIdSets([diffIdSet(insertDiff, deleteDiff), diffIdSet(deleteDiff, insertDiff)])
  /**
   * @type {Map<YNode, Set<string|null>>}
   */
  const changedTypes = computeModifiedFromItems(v2.store, itemsToRender)
  const d = delta.create()
  v2.share.forEach((type, typename) => {
    const typeConf = changedTypes.get(type)
    if (typeConf) {
      const shareDelta = type.toDelta({
        renderer, itemsToRender, insertedItems: insertDiff, retainDeletes: true, modified: changedTypes, deep: true
      })
      d.modifyAttr(typename, shareDelta)
    }
  })
  return d
}
