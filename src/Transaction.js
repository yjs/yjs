
/**
 * Changes that are created within a transaction are bundled and sent as one
 * message to the remote peers. This implies that the changes are applied
 * in one flush and at most one {@link YEvent} per type is created.
 *
 * It is best to bundle as many changes in a single Transaction as possible.
 * This way only few changes need to be computed
 */
export default class Transaction {
  constructor (y) {
    this.y = y
    // types added during transaction
    this.newTypes = new Set()
    // changed types (does not include new types)
    // maps from type to parentSubs (item._parentSub = null for array elements)
    this.changedTypes = new Map()
    this.deletedStructs = new Set()
    this.beforeState = new Map()
    this.changedParentTypes = new Map()
  }
}

export function transactionTypeChanged (y, type, sub) {
  if (type !== y && !type._deleted && !y._transaction.newTypes.has(type)) {
    const changedTypes = y._transaction.changedTypes
    let subs = changedTypes.get(type)
    if (subs === undefined) {
      // create if it doesn't exist yet
      subs = new Set()
      changedTypes.set(type, subs)
    }
    subs.add(sub)
  }
}
