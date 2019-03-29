import { AbstractStruct } from '../structs/AbstractStruct.js' // eslint-disable-line
import { AbstractItem } from '../structs/AbstractItem.js' // eslint-disable-line
import { ItemType } from '../structs/ItemType.js' // eslint-disable-line
import { ID } from './ID.js' // eslint-disable-line
import { Transaction } from './Transaction.js' // eslint-disable-line
import * as map from 'lib0/map.js'
import * as math from 'lib0/math.js'

export class StructStore {
  constructor () {
    /**
     * @type {Map<number,Array<AbstractStruct>>}
     */
    this.clients = new Map()
  }
}

/**
 * Return the states as an array of {client,clock} pairs.
 * Note that clock refers to the next expected clock id.
 *
 * @param {StructStore} store
 * @return {Array<{client:number,clock:number}>}
 */
export const getStates = store =>
  map.map(store.clients, (structs, client) => {
    const struct = structs[structs.length - 1]
    return {
      client,
      clock: struct.id.clock + struct.length
    }
  })

/**
 * @param {StructStore} store
 * @param {number} client
 */
export const getState = (store, client) => {
  const structs = store.clients.get(client)
  if (structs === undefined) {
    return 0
  }
  const lastStruct = structs[structs.length - 1]
  return lastStruct.id.clock + lastStruct.length
}

/**
 * @param {StructStore} store
 */
export const integretyCheck = store => {
  store.clients.forEach(structs => {
    for (let i = 1; i < structs.length; i++) {
      const l = structs[i - 1]
      const r = structs[i]
      if (l.id.clock + l.length !== r.id.clock) {
        throw new Error('StructStore failed integrety check')
      }
    }
  })
}

/**
 * @param {StructStore} store
 * @param {AbstractStruct} struct
 */
export const addStruct = (store, struct) => {
  map.setIfUndefined(store.clients, struct.id.client, () => []).push(struct)
}

/**
 * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
 * @param {Array<AbstractStruct>} structs // ordered structs without holes
 * @param {number} clock
 * @return {number}
 * @private
 */
export const findIndex = (structs, clock) => {
  let left = 0
  let right = structs.length
  while (left <= right) {
    const midindex = math.floor((left + right) / 2)
    const mid = structs[midindex]
    const midclock = mid.id.clock
    if (midclock <= clock) {
      if (clock < midclock + mid.length) {
        return midindex
      }
      left = midindex
    } else {
      right = midindex
    }
  }
  throw new Error('ID does not exist')
}

/**
 * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
 *
 * @param {StructStore} store
 * @param {ID} id
 * @return {AbstractStruct}
 * @private
 */
const find = (store, id) => {
  /**
   * @type {Array<AbstractStruct>}
   */
  // @ts-ignore
  const structs = store.clients.get(id.client)
  return structs[findIndex(structs, id.clock)]
}

/**
 * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
 *
 * @param {StructStore} store
 * @param {ID} id
 * @return {ItemType}
 */
// @ts-ignore
export const getItemType = (store, id) => find(store, id)

/**
 * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
 * @param {StructStore} store
 * @param {Transaction} transaction
 * @param {ID} id
 * @return {AbstractItem}
 *
 * @private
 */
export const getItemCleanStart = (store, transaction, id) => {
  /**
   * @type {Array<AbstractItem>}
   */
  // @ts-ignore
  const structs = store.clients.get(id.client)
  const index = findIndex(structs, id.clock)
  /**
   * @type {AbstractItem}
   */
  let struct = structs[index]
  if (struct.id.clock < id.clock) {
    struct.splitAt()
    struct = splitStruct(transaction, struct, id.clock - struct.id.clock)
    structs.splice(index, 0, struct)
  }
  return struct
}

/**
 * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
 * @param {StructStore} store
 * @param {Transaction} transaction
 * @param {ID} id
 * @return {AbstractItem}
 *
 * @private
 */
export const getItemCleanEnd = (store, transaction, id) => {
  /**
   * @type {Array<AbstractItem>}
   */
  // @ts-ignore
  const structs = store.clients.get(id.client)
  const index = findIndex(structs, id.clock)
  const struct = structs[index]
  if (id.clock !== struct.id.clock + struct.length - 1) {
    structs.splice(index, 0, splitStruct(transaction, struct, id.clock - struct.id.clock + 1))
  }
  return struct
}

/**
 * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
 * @param {StructStore} store
 * @param {Transaction} transaction
 * @param {number} client
 * @param {number} clock
 * @param {number} len
 * @return {Array<AbstractItem>}
 *
 * @private
 */
export const getItemRange = (store, transaction, client, clock, len) => {
  /**
   * @type {Array<AbstractItem>}
   */
  // @ts-ignore
  const structs = store.clients.get(client)
  let index = findIndex(structs, clock)
  let struct = structs[index]
  let range = []
  if (struct.id.clock < clock) {
    struct = splitStruct(transaction, struct, clock - struct.id.clock)
    structs.splice(index, 0, struct)
  }
  while (struct.id.clock + struct.length <= clock + len) {
    range.push(struct)
    struct = structs[++index]
  }
  if (clock < struct.id.clock + struct.length) {
    structs.splice(index, 0, splitStruct(transaction, struct, clock + len - struct.id.clock))
    range.push(struct)
  }
  return range
}

/**
 * Replace `item` with `newitem` in store
 * @param {StructStore} store
 * @param {AbstractStruct} struct
 * @param {AbstractStruct} newStruct
 */
export const replaceStruct = (store, struct, newStruct) => {
  /**
   * @type {Array<AbstractStruct>}
   */
  // @ts-ignore
  const structs = store.clients.get(struct.id.client)
  structs[findIndex(structs, struct.id.clock)] = newStruct
}
