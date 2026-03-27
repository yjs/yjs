import * as math from 'lib0/math'
import * as error from 'lib0/error'
import * as map from 'lib0/map'
import * as set from 'lib0/set'

import { createID } from './ID.js'

/**
 * These modules don't require any imports.
 * These helpers are used by items to integrate themselves
 */

/**
 * Perform a binary search on a sorted array
 * @param {Array<Item|GC|Skip>} structs
 * @param {number} clock
 * @return {number}
 *
 * @private
 * @function
 */
export const findIndexSS = (structs, clock) => {
  let left = 0
  let right = structs.length - 1
  let mid = structs[right]
  let midclock = mid.id.clock
  if (midclock === clock) {
    return right
  }
  // @todo does it even make sense to pivot the search?
  // If a good split misses, it might actually increase the time to find the correct item.
  // Currently, the only advantage is that search with pivoting might find the item on the first try.
  let midindex = math.floor((clock / (midclock + mid.length - 1)) * right) // pivoting the search
  while (left <= right) {
    mid = structs[midindex]
    midclock = mid.id.clock
    if (midclock <= clock) {
      if (clock < midclock + mid.length) {
        return midindex
      }
      left = midindex + 1
    } else {
      right = midindex - 1
    }
    midindex = math.floor((left + right) / 2)
  }
  // Always check state before looking for a struct in StructStore
  // Therefore the case of not finding a struct is unexpected
  throw error.unexpectedCase()
}

/**
 * @param {Transaction?} transaction
 * @param {Array<Item|GC|Skip>} structs
 * @param {number} clock
 */
export const findIndexCleanStart = (transaction, structs, clock) => {
  const index = findIndexSS(structs, clock)
  const struct = structs[index]
  if (struct.id.clock < clock) {
    structs.splice(index + 1, 0, splitStruct(transaction, struct, clock - struct.id.clock))
    return index + 1
  }
  return index
}

/**
 * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
 *
 * @param {Transaction} transaction
 * @param {ID} id
 * @return {Item}
 *
 * @private
 * @function
 */
export const getItemCleanStart = (transaction, id) => {
  const structs = /** @type {Array<Item>} */ (transaction.doc.store.clients.get(id.client))
  return structs[findIndexCleanStart(transaction, structs, id.clock)]
}

/**
 * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
 *
 * @param {Transaction} transaction
 * @param {StructStore} store
 * @param {ID} id
 * @return {Item}
 *
 * @private
 * @function
 */
export const getItemCleanEnd = (transaction, store, id) => {
  const structs = store.clients.get(id.client) || []
  const index = findIndexSS(structs, id.clock)
  const struct = structs[index]
  if (id.clock !== struct.id.clock + struct.length - 1 && struct.isItem) {
    structs.splice(index + 1, 0, /** @type {Item} */ (struct).split(transaction, id.clock - struct.id.clock + 1))
  }
  return /** @type {Item} */ (struct)
}

/**
 * Replace `item` with `newitem` in store
 * @param {Transaction} tr
 * @param {GC|Item} struct
 * @param {GC|Item} newStruct
 *
 * @private
 * @function
 */
export const replaceStruct = (tr, struct, newStruct) => {
  const structs = /** @type {Array<GC|Item>} */ (tr.doc.store.clients.get(struct.id.client))
  structs[findIndexSS(structs, struct.id.clock)] = newStruct
  tr._mergeStructs.push(newStruct)
}

/**
 * Iterate over a range of structs
 *
 * @param {Transaction} transaction
 * @param {Array<Item|GC>} structs
 * @param {number} clockStart Inclusive start
 * @param {number} len
 * @param {function(GC|Item):void} f
 *
 * @function
 */
export const iterateStructs = (transaction, structs, clockStart, len, f) => {
  if (len === 0) {
    return
  }
  const clockEnd = clockStart + len
  let index = findIndexCleanStart(transaction, structs, clockStart)
  let struct
  do {
    struct = structs[index++]
    if (clockEnd < struct.id.clock + struct.length) {
      findIndexCleanStart(transaction, structs, clockEnd)
    }
    f(struct)
  } while (index < structs.length && structs[index].id.clock < clockEnd)
}

/**
 * More generalized version of splitItem. Split leftStruct into two structs
 * @param {Transaction?} transaction
 * @param {Item|GC|Skip} leftStruct
 * @param {number} diff
 * @return {GC|Item|Skip}
 *
 * @function
 * @private
 */
export const splitStruct = (transaction, leftStruct, diff) => {
  if (leftStruct.isItem) {
    return /** @type {Item} */ (leftStruct).split(transaction, diff)
  } else {
    const rightItem = leftStruct.splice(diff)
    transaction?._mergeStructs.push(rightItem)
    return rightItem
  }
}

/**
 * @param {Transaction} transaction
 *
 * @private
 * @function
 */
export const nextID = transaction => {
  const y = transaction.doc
  return createID(y.clientID, y.store.getClock(y.clientID))
}

/**
 * If `type.parent` was added in current transaction, `type` technically
 * did not change, it was just added and we should not fire events for `type`.
 *
 * @param {Transaction} transaction
 * @param {YType} type
 * @param {string|null} parentSub
 */
export const addChangedTypeToTransaction = (transaction, type, parentSub) => {
  const item = type._item
  if (item === null || (!item.deleted && !transaction.insertSet.hasId(item.id))) {
    map.setIfUndefined(transaction.changed, type, set.create).add(parentSub)
  }
}

/**
 * @param {Array<GC | Item | Skip>} structs
 * @param {number} pos
 * @return {number} # of merged structs
 */
export const tryToMergeWithLefts = (structs, pos) => {
  let right = structs[pos]
  let left = structs[pos - 1]
  let i = pos
  for (; i > 0; right = left, left = structs[--i - 1]) {
    if (left.deleted === right.deleted && left.constructor === right.constructor) {
      if (left.mergeWith(/** @type {any} */ (right))) {
        if (right.isItem && /** @type {Item} */ (right).parentSub !== null && /** @type {YType} */ (/** @type {Item} */ (right).parent)._map.get(/** @type {Item} */ (right).parentSub) === right) {
          /** @type {YType} */ (right.parent)._map.set(right.parentSub, /** @type {Item} */ (left))
        }
        continue
      }
    }
    break
  }
  const merged = pos - i
  if (merged) {
    // remove all merged structs from the array
    structs.splice(pos + 1 - merged, merged)
  }
  return merged
}

/**
 * @param {Transaction} tr
 * @param {IdSet} ds
 * @param {function(Item):boolean} gcFilter
 */
export const tryGcDeleteSet = (tr, ds, gcFilter) => {
  for (const [client, _deleteItems] of ds.clients.entries()) {
    const deleteItems = _deleteItems.getIds()
    const structs = /** @type {Array<Item>} */ (tr.doc.store.clients.get(client))
    for (let di = deleteItems.length - 1; di >= 0; di--) {
      const deleteItem = deleteItems[di]
      const endDeleteItemClock = deleteItem.clock + deleteItem.len
      for (
        let si = findIndexSS(structs, deleteItem.clock), struct = structs[si];
        si < structs.length && struct.id.clock < endDeleteItemClock;
        struct = structs[++si]
      ) {
        const struct = structs[si]
        if (deleteItem.clock + deleteItem.len <= struct.id.clock) {
          break
        }
        if (struct.isItem && struct.deleted && !(struct).keep && gcFilter(/** @type {Item} */ (struct))) {
          /** @type {Item} */ (struct).gc(tr, false)
        }
      }
    }
  }
}

/**
 * @param {IdSet} ds
 * @param {StructStore} store
 */
export const tryMerge = (ds, store) => {
  // try to merge deleted / gc'd items
  // merge from right to left for better efficiency and so we don't miss any merge targets
  ds.clients.forEach((_deleteItems, client) => {
    const deleteItems = _deleteItems.getIds()
    const structs = /** @type {Array<GC|Item>} */ (store.clients.get(client))
    for (let di = deleteItems.length - 1; di >= 0; di--) {
      const deleteItem = deleteItems[di]
      // start with merging the item next to the last deleted item
      const mostRightIndexToCheck = math.min(structs.length - 1, 1 + findIndexSS(structs, deleteItem.clock + deleteItem.len - 1))
      for (
        let si = mostRightIndexToCheck, struct = structs[si];
        si > 0 && struct.id.clock >= deleteItem.clock;
        struct = structs[si]
      ) {
        si -= 1 + tryToMergeWithLefts(structs, si)
      }
    }
  })
}

/**
 * @param {Transaction} tr
 * @param {IdSet} idset
 * @param {function(Item):boolean} gcFilter
 */
export const tryGc = (tr, idset, gcFilter) => {
  tryGcDeleteSet(tr, idset, gcFilter)
  tryMerge(idset, tr.doc.store)
}

/**
 * @param {Transaction} transaction
 * @param {Item | null} item
 */
export const cleanupContextlessFormattingGap = (transaction, item) => {
  if (!transaction.doc.cleanupFormatting) return 0
  // iterate until item.right is null or content
  while (item && item.right && (item.right.deleted || !item.right.countable)) {
    item = item.right
  }
  const attrs = new Set()
  // iterate back until a content item is found
  while (item && (item.deleted || !item.countable)) {
    if (!item.deleted && item.content.getRef() === 6) { // is a ContentFormat
      const key = /** @type {ContentFormat} */ (item.content).key
      if (attrs.has(key)) {
        item.delete(transaction)
        transaction.cleanUps.add(item.id.client, item.id.clock, item.length)
      } else {
        attrs.add(key)
      }
    }
    item = item.left
  }
}

/**
 * @param {Map<string,any>} currentAttributes
 * @param {ContentFormat} format
 *
 * @private
 * @function
 */
export const updateCurrentAttributes = (currentAttributes, { key, value }) => {
  if (value === null) {
    currentAttributes.delete(key)
  } else {
    currentAttributes.set(key, value)
  }
}

/**
 * Call this function after string content has been deleted in order to
 * clean up formatting Items.
 *
 * @param {Transaction} transaction
 * @param {Item} start
 * @param {Item|null} curr exclusive end, automatically iterates to the next Content Item
 * @param {Map<string,any>} startAttributes
 * @param {Map<string,any>} currAttributes
 * @return {number} The amount of formatting Items deleted.
 *
 * @function
 */
export const cleanupFormattingGap = (transaction, start, curr, startAttributes, currAttributes) => {
  if (!transaction.doc.cleanupFormatting) return 0
  /**
   * @type {Item|null}
   */
  let end = start
  /**
   * @type {Map<string,ContentFormat>}
   */
  const endFormats = map.create()
  while (end && (!end.countable || end.deleted)) {
    if (!end.deleted && end.content.getRef() === 6) {
      const cf = /** @type {ContentFormat} */ (end.content)
      endFormats.set(cf.key, cf)
    }
    end = end.right
  }
  let cleanups = 0
  let reachedCurr = false
  while (start !== end) {
    if (curr === start) {
      reachedCurr = true
    }
    if (!start.deleted) {
      const content = start.content
      if (content.getRef() === 6) { // is ContentFormat
        const { key, value } = /** @type {ContentFormat} */ (content)
        const startAttrValue = startAttributes.get(key) ?? null
        if (endFormats.get(key) !== content || startAttrValue === value) {
          // Either this format is overwritten or it is not necessary because the attribute already existed.
          start.delete(transaction)
          transaction.cleanUps.add(start.id.client, start.id.clock, start.length)
          cleanups++
          if (!reachedCurr && (currAttributes.get(key) ?? null) === value && startAttrValue !== value) {
            if (startAttrValue === null) {
              currAttributes.delete(key)
            } else {
              currAttributes.set(key, startAttrValue)
            }
          }
        }
        if (!reachedCurr && !start.deleted) {
          updateCurrentAttributes(currAttributes, /** @type {ContentFormat} */ (content))
        }
      }
    }
    start = /** @type {Item} */ (start.right)
  }
  return cleanups
}
