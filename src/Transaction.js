
export default class Transaction {
  constructor (y) {
    this.y = y
    // types added during transaction
    this.newTypes = new Set()
    // changed types (does not include new types)
    // maps from type to parentSubs (item.parentSub = null for array elements)
    this.changedTypes = new Map()
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
