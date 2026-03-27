import { Skip } from '../structs/Skip.js'
import { createID } from './ID.js'
import { createDeleteSetFromStructStore, createIdSet } from './ids.js'
import { findIndexSS } from './transaction-helpers.js'

export class StructStore {
  constructor () {
    /**
     * @type {Map<number,Array<GC|Item|Skip>>}
     */
    this.clients = new Map()
    // this.ds = new IdSet()
    /**
     * @type {null | { missing: Map<number, number>, update: Uint8Array<ArrayBuffer> }}
     */
    this.pendingStructs = null
    /**
     * @type {null | Uint8Array<ArrayBuffer>}
     */
    this.pendingDs = null
    this.skips = createIdSet()
  }

  get ds () {
    return createDeleteSetFromStructStore(this)
  }

  /**
   * @param {GC|Item|Skip} struct
   * @function
   */
  add (struct) {
    let structs = this.clients.get(struct.id.client)
    if (structs === undefined) {
      structs = []
      this.clients.set(struct.id.client, structs)
    } else {
      const lastStruct = structs[structs.length - 1]
      if (lastStruct.id.clock + lastStruct.length !== struct.id.clock) {
        // this replaces an integrated skip
        let index = findIndexSS(structs, struct.id.clock)
        const skip = structs[index]
        const diffStart = struct.id.clock - skip.id.clock
        const diffEnd = skip.id.clock + skip.length - struct.id.clock - struct.length
        if (diffStart > 0) {
          structs.splice(index++, 0, new Skip(createID(struct.id.client, skip.id.clock), diffStart))
        }
        if (diffEnd > 0) {
          structs.splice(index + 1, 0, new Skip(createID(struct.id.client, struct.id.clock + struct.length), diffEnd))
        }
        structs[index] = struct
        this.skips.delete(struct.id.client, struct.id.clock, struct.length)
        return
      }
    }
    structs.push(struct)
  }

  /**
   * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
   *
   * @param {ID} id
   * @return {GC|Item}
   */
  get (id) {
    const structs = /** @type {Array<GC|Item>} */ (this.clients.get(id.client))
    return structs[findIndexSS(structs, id.clock)]
  }

  /**
   * Expects that id is actually in store. This function throws or is an infinite loop otherwise.
   *
   * @param {ID} id
   * @return {Item}
   */
  getItem (id) {
    const structs = /** @type {Array<GC|Item>} */ (this.clients.get(id.client))
    return /** @type {Item} */ (structs[findIndexSS(structs, id.clock)])
  }

  /**
   * Get the next expected clock for a specific client.
   *
   * @param {number} client
   * @return {number}
   *
   * @public
   * @function
   */
  getClock (client) {
    const structs = this.clients.get(client)
    if (structs === undefined) {
      return 0
    }
    const lastStruct = structs[structs.length - 1]
    return lastStruct.id.clock + lastStruct.length
  }

  /**
   * Perform a binary search on a sorted array
   * @param {ID} id
   * @return {{ structs: Array<GC|Item|Skip>, index: number }}
   *
   * @function
   */
  getIndex (id) {
    const structs = this.clients.get(id.client) || []
    const index = findIndexSS(structs, id.clock)
    return { structs, index }
  }
}

/**
 * Return the states as a Map<client,clock>.
 * Note that clock refers to the next expected clock id.
 *
 * @param {StructStore} store
 * @return {Map<number,number>}
 *
 * @public
 * @function
 */
export const getStateVector = store => {
  const sm = new Map()
  store.clients.forEach((structs, client) => {
    const struct = structs[structs.length - 1]
    sm.set(client, struct.id.clock + struct.length)
  })
  store.skips.clients.forEach((range, client) => {
    sm.set(client, range.getIds()[0].clock)
  })
  return sm
}

/**
 * @param {StructStore} store
 *
 * @private
 * @function
 */
export const integrityCheck = store => {
  store.clients.forEach(structs => {
    for (let i = 1; i < structs.length; i++) {
      const l = structs[i - 1]
      const r = structs[i]
      if (l.id.clock + l.length !== r.id.clock) {
        throw new Error('StructStore failed integrity check')
      }
    }
  })
}
