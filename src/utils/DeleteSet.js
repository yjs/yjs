import * as map from 'lib0/map.js'
import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import { StructStore, getItemRange } from './StructStore.js' // eslint-disable-line
import { Transaction } from './Transaction.js' // eslint-disable-line
import { ID } from './ID.js' // eslint-disable-line

class DeleteItem {
  /**
   * @param {number} clock
   * @param {number} len
   */
  constructor (clock, len) {
    /**
     * @type {number}
     */
    this.clock = clock
    /**
     * @type {number}
     */
    this.len = len
  }
}

/**
 * We no longer maintain a DeleteStore. DeleteSet is a temporary object that is created when needed.
 * - When created in a transaction, it must only be accessed after sorting, and merging
 *   - This DeleteSet is send to other clients
 * - We do not create a DeleteSet when we send a sync message. The DeleteSet message is created directly from StructStore
 * - We read a DeleteSet as part of a sync/update message. In this case the DeleteSet is already sorted and merged.
 *
 */
export class DeleteSet {
  constructor () {
    /**
     * @type {Map<number,Array<DeleteItem>>}
     */
    this.clients = new Map()
  }
}

/**
 * @param {DeleteSet} ds
 * @param {ID} id
 * @return {boolean}
 */
export const isDeleted = (ds, id) => {
  
}

/**
 * @param {DeleteSet} ds
 */
export const sortAndMergeDeleteSet = ds => {
  ds.clients.forEach(dels => {
    dels.sort((a, b) => a.clock - b.clock)
    // i is the current pointer
    // j refers to the current insert position for the pointed item
    // try to merge dels[i] with dels[i-1]
    let i, j
    for (i = 1, j = 1; i < dels.length; i++) {
      const left = dels[i - 1]
      const right = dels[i]
      if (left.clock + left.len === right.clock) {
        left.len += right.len
      } else {
        if (j < i) {
          dels[j] = right
        }
        j++
      }
    }
    dels.length = j
  })
}

/**
 * @param {Transaction} transaction
 */
export const createDeleteSetFromTransaction = transaction => {
  const ds = new DeleteSet()
  transaction.deleted.forEach(item => {
    map.setIfUndefined(ds.clients, item.id.client, () => []).push(new DeleteItem(item.id.clock, item.length))
  })
  sortAndMergeDeleteSet(ds)
  return ds
}

/**
 * @param {StructStore} ss
 * @return {DeleteSet} Merged and sorted DeleteSet
 */
export const createDeleteSetFromStructStore = ss => {
  const ds = new DeleteSet()
  ss.clients.forEach((structs, client) => {
    /**
     * @type {Array<DeleteItem>}
     */
    const dsitems = []
    for (let i = 0; i < structs.length; i++) {
      const struct = structs[i]
      const clock = struct.id.clock
      let len = struct.length
      if (i + 1 < structs.length) {
        for (let next = structs[i + 1]; i + 1 < structs.length && next.id.clock === clock + len; i++) {
          len += next.length
        }
      }
      dsitems.push(new DeleteItem(clock, len))
    }
    if (dsitems.length > 0) {
      ds.clients.set(client, dsitems)
    }
  })
  return ds
}

/**
 * @param {encoding.Encoder} encoder
 * @param {DeleteSet} ds
 */
export const writeDeleteSet = (encoder, ds) => {
  encoding.writeVarUint(encoder, ds.clients.size)
  ds.clients.forEach((dsitems, client) => {
    encoding.writeVarUint(encoder, client)
    const len = dsitems.length
    encoding.writeVarUint(encoder, len)
    for (let i = 0; i < len; i++) {
      const item = dsitems[i]
      encoding.writeVarUint(encoder, item.clock)
      encoding.writeVarUint(encoder, item.len)
    }
  })
}

/**
 * @param {decoding.Decoder} decoder
 * @param {StructStore} ss
 * @param {Transaction} transaction
 */
export const readDeleteSet = (decoder, ss, transaction) => {
  const numClients = decoding.readVarUint(decoder)
  for (let i = 0; i < numClients; i++) {
    const client = decoding.readVarUint(decoder)
    const len = decoding.readVarUint(decoder)
    for (let i = 0; i < len; i++) {
      const clock = decoding.readVarUint(decoder)
      const len = decoding.readVarUint(decoder)
      getItemRange(ss, transaction, client, clock, len).forEach(struct => struct.delete(transaction))
    }
  }
}
