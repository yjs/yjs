import {
  findIndexSS,
  getState,
  splitItem,
  iterateStructs,
  UpdateEncoderV2,
  IdMap,
  AttrRanges,
  AttrRange,
  AbstractStruct, DSDecoderV1, IdSetEncoderV1, DSDecoderV2, IdSetEncoderV2, Item, GC, StructStore, Transaction, ID, AttributionItem, // eslint-disable-line
} from '../internals.js'

import * as array from 'lib0/array'
import * as math from 'lib0/math'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

export class IdRange {
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

  /**
   * @param {number} clock
   * @param {number} len
   */
  copyWith (clock, len) {
    return new IdRange(clock, len)
  }

  /**
   * Helper method making this compatible with IdMap.
   *
   * @return {Array<import('./IdMap.js').AttributionItem<any>>}
   */
  get attrs () {
    return []
  }
}

export class MaybeIdRange {
  /**
   * @param {number} clock
   * @param {number} len
   * @param {boolean} exists
   */
  constructor (clock, len, exists) {
    /**
     * @type {number}
     */
    this.clock = clock
    /**
     * @type {number}
     */
    this.len = len
    /**
     * @type {boolean}
     */
    this.exists = exists
  }
}

/**
 * @param {number} clock
 * @param {number} len
 * @param {boolean} exists
 * @return {MaybeIdRange}
 */
export const createMaybeIdRange = (clock, len, exists) => new MaybeIdRange(clock, len, exists)

class IdRanges {
  /**
   * @param {Array<IdRange>} ids
   */
  constructor (ids) {
    this.sorted = false
    /**
     * @private
     */
    this._ids = ids
  }

  copy () {
    return new IdRanges(this._ids.slice())
  }

  /**
   * @param {number} clock
   * @param {number} length
   */
  add (clock, length) {
    const last = this._ids[this._ids.length - 1]
    if (last.clock + last.len === clock) {
      this._ids[this._ids.length - 1] = new IdRange(last.clock, last.len + length)
    } else {
      this.sorted = false
      this._ids.push(new IdRange(clock, length))
    }
  }

  /**
   * Return the list of id ranges, sorted and merged.
   */
  getIds () {
    const ids = this._ids
    if (!this.sorted) {
      this.sorted = true
      ids.sort((a, b) => a.clock - b.clock)
      // merge items without filtering or splicing the array
      // i is the current pointer
      // j refers to the current insert position for the pointed item
      // try to merge dels[i] into dels[j-1] or set dels[j]=dels[i]
      let i, j
      for (i = 1, j = 1; i < ids.length; i++) {
        const left = ids[j - 1]
        const right = ids[i]
        if (left.clock + left.len >= right.clock) {
          const r = right.clock + right.len - left.clock
          if (left.len < r) {
            ids[j - 1] = new IdRange(left.clock, r)
          }
        } else if (left.len === 0) {
          ids[j - 1] = right
        } else {
          if (j < i) {
            ids[j] = right
          }
          j++
        }
      }
      ids.length = ids[j - 1].len === 0 ? j - 1 : j
    }
    return ids
  }
}

export class IdSet {
  constructor () {
    /**
     * @type {Map<number,IdRanges>}
     */
    this.clients = new Map()
  }

  /**
   * @param {(idrange:IdRange, client:number) => void} f
   */
  forEach (f) {
    this.clients.forEach((ranges, client) => {
      ranges.getIds().forEach((range) => {
        f(range, client)
      })
    })
  }

  /**
   * @param {ID} id
   * @return {boolean}
   */
  hasId (id) {
    return this.has(id.client, id.clock)
  }

  /**
   * @param {number} client
   * @param {number} clock
   */
  has (client, clock) {
    const dr = this.clients.get(client)
    if (dr) {
      return findIndexInIdRanges(dr.getIds(), clock) !== null
    }
    return false
  }

  /**
   * Return slices of ids that exist in this idset.
   *
   * @param {number} client
   * @param {number} clock
   * @param {number} len
   * @return {Array<MaybeIdRange>}
   */
  slice (client, clock, len) {
    const dr = this.clients.get(client)
    /**
     * @type {Array<MaybeIdRange>}
     */
    const res = []
    if (dr) {
      /**
       * @type {Array<IdRange>}
       */
      const ranges = dr.getIds()
      let index = findRangeStartInIdRanges(ranges, clock)
      if (index !== null) {
        let prev = null
        while (index < ranges.length) {
          let r = ranges[index]
          if (r.clock < clock) {
            r = new IdRange(clock, r.len - (clock - r.clock))
          }
          if (r.clock + r.len > clock + len) {
            r = new IdRange(r.clock, clock + len - r.clock)
          }
          if (r.len <= 0) break
          const prevEnd = prev != null ? prev.clock + prev.len : clock
          if (prevEnd < r.clock) {
            res.push(createMaybeIdRange(prevEnd, r.clock - prevEnd, false))
          }
          prev = r
          res.push(createMaybeIdRange(r.clock, r.len, true))
          index++
        }
      }
    }
    if (res.length > 0) {
      const last = res[res.length - 1]
      const end = last.clock + last.len
      if (end < clock + len) {
        res.push(createMaybeIdRange(end, clock + len - end, false))
      }
    } else {
      res.push(createMaybeIdRange(clock, len, false))
    }
    return res
  }

  /**
   * @param {number} client
   * @param {number} clock
   * @param {number} len
   */
  add (client, clock, len) {
    addToIdSet(this, client, clock, len)
  }

  /**
   * @param {number} client
   * @param {number} clock
   * @param {number} len
   */
  delete (client, clock, len) {
    _deleteRangeFromIdSet(this, client, clock, len)
  }
}

/**
 * @param {IdSet | IdMap<any>} set
 * @param {number} client
 * @param {number} clock
 * @param {number} len
 */
export const _deleteRangeFromIdSet = (set, client, clock, len) => {
  const dr = set.clients.get(client)
  if (dr && len > 0) {
    const ids = dr.getIds()
    let index = findRangeStartInIdRanges(ids, clock)
    if (index != null) {
      for (let r = ids[index]; index < ids.length && r.clock < clock + len; r = ids[++index]) {
        if (r.clock < clock) {
          ids[index] = r.copyWith(r.clock, clock - r.clock)
          if (clock + len < r.clock + r.len) {
            ids.splice(index + 1, 0, r.copyWith(clock + len, r.clock + r.len - clock - len))
          }
        } else if (clock + len < r.clock + r.len) {
          // need to retain end
          ids[index] = r.copyWith(clock + len, r.clock + r.len - clock - len)
        } else if (ids.length === 1) {
          set.clients.delete(client)
          return
        } else {
          ids.splice(index--, 1)
        }
      }
    }
  }
}

/**
 * Iterate over all structs that are mentioned by the IdSet.
 *
 * @param {Transaction} transaction
 * @param {IdSet} ds
 * @param {function(GC|Item):void} f
 *
 * @function
 */
export const iterateStructsByIdSet = (transaction, ds, f) =>
  ds.clients.forEach((idRanges, clientid) => {
    const ranges = idRanges.getIds()
    const structs = /** @type {Array<GC|Item>} */ (transaction.doc.store.clients.get(clientid))
    if (structs != null) {
      for (let i = 0; i < ranges.length; i++) {
        const del = ranges[i]
        iterateStructs(transaction, structs, del.clock, del.len, f)
      }
    }
  })

/**
 * @param {Array<IdRange>} dis
 * @param {number} clock
 * @return {number|null}
 *
 * @private
 * @function
 */
export const findIndexInIdRanges = (dis, clock) => {
  let left = 0
  let right = dis.length - 1
  while (left <= right) {
    const midindex = math.floor((left + right) / 2)
    const mid = dis[midindex]
    const midclock = mid.clock
    if (midclock <= clock) {
      if (clock < midclock + mid.len) {
        return midindex
      }
      left = midindex + 1
    } else {
      right = midindex - 1
    }
  }
  return null
}

/**
 * Find the first range that contains clock or comes after clock.
 *
 * @param {Array<IdRange>} dis
 * @param {number} clock
 * @return {number|null}
 *
 * @private
 * @function
 */
export const findRangeStartInIdRanges = (dis, clock) => {
  let left = 0
  let right = dis.length - 1
  while (left <= right) {
    const midindex = math.floor((left + right) / 2)
    const mid = dis[midindex]
    const midclock = mid.clock
    if (midclock <= clock) {
      if (clock < midclock + mid.len) {
        return midindex
      }
      left = midindex + 1
    } else {
      right = midindex - 1
    }
  }
  return left < dis.length ? left : null
}

/**
 * @param {Array<IdSet>} idSets
 * @return {IdSet} A fresh IdSet
 */
export const mergeIdSets = idSets => {
  const merged = new IdSet()
  for (let dssI = 0; dssI < idSets.length; dssI++) {
    idSets[dssI].clients.forEach((rangesLeft, client) => {
      if (!merged.clients.has(client)) {
        // Write all missing keys from current ds and all following.
        // If merged already contains `client` current ds has already been added.
        const ids = rangesLeft.getIds().slice()
        for (let i = dssI + 1; i < idSets.length; i++) {
          const nextIds = idSets[i].clients.get(client)
          if (nextIds) {
            array.appendTo(ids, nextIds.getIds())
          }
        }
        merged.clients.set(client, new IdRanges(ids))
      }
    })
  }
  return merged
}

/**
 * @template {IdSet | IdMap<any>} S
 * @param {S} dest
 * @param {S} src
 */
export const _insertIntoIdSet = (dest, src) => {
  src.clients.forEach((srcRanges, client) => {
    const targetRanges = dest.clients.get(client)
    if (targetRanges) {
      array.appendTo(targetRanges.getIds(), srcRanges.getIds())
      targetRanges.sorted = false
    } else {
      const res = srcRanges.copy()
      res.sorted = true
      dest.clients.set(client, /** @type {any} */ (res))
    }
  })
}

/**
 * @param {IdSet} dest
 * @param {IdSet} src
 */
export const insertIntoIdSet = _insertIntoIdSet

/**
 * Remove all ranges from `exclude` from `ds`. The result is a fresh IdSet containing all ranges from `idSet` that are not
 * in `exclude`.
 *
 * @template {IdSet | IdMap<any>} Set
 * @param {Set} set
 * @param {IdSet | IdMap<any>} exclude
 * @return {Set}
 */
export const _diffSet = (set, exclude) => {
  /**
   * @type {Set}
   */
  const res = /** @type {any } */ (set instanceof IdSet ? new IdSet() : new IdMap())
  const Ranges = set instanceof IdSet ? IdRanges : AttrRanges
  set.clients.forEach((_setRanges, client) => {
    /**
     * @type {Array<IdRange>}
     */
    let resRanges = []
    const _excludedRanges = exclude.clients.get(client)
    const setRanges = _setRanges.getIds()
    if (_excludedRanges == null) {
      resRanges = setRanges.slice()
    } else {
      const excludedRanges = _excludedRanges.getIds()
      let i = 0; let j = 0
      let currRange = setRanges[0]
      while (i < setRanges.length && j < excludedRanges.length) {
        const e = excludedRanges[j]
        if (currRange.clock + currRange.len <= e.clock) { // no overlapping, use next range item
          if (currRange.len > 0) resRanges.push(currRange)
          currRange = setRanges[++i]
        } else if (e.clock + e.len <= currRange.clock) { // no overlapping, use next excluded item
          j++
        } else if (e.clock <= currRange.clock) { // exclude laps into range (we already know that the ranges somehow collide)
          const newClock = e.clock + e.len
          const newLen = currRange.clock + currRange.len - newClock
          if (newLen > 0) {
            currRange = currRange.copyWith(newClock, newLen)
            j++
          } else {
            // this item is completely overwritten. len=0. We can jump to the next range
            currRange = setRanges[++i]
          }
        } else { // currRange.clock < e.clock -- range laps into exclude => adjust len
          // beginning can't be empty, add it to the result
          const nextLen = e.clock - currRange.clock
          resRanges.push(currRange.copyWith(currRange.clock, nextLen))
          // retain the remaining length after exclude in currRange
          currRange = currRange.copyWith(currRange.clock + e.len + nextLen, math.max(currRange.len - e.len - nextLen, 0))
          if (currRange.len === 0) currRange = setRanges[++i]
          else j++
        }
      }
      if (currRange != null) {
        resRanges.push(currRange)
      }
      i++
      while (i < setRanges.length) {
        resRanges.push(setRanges[i++])
      }
    }
    // @ts-ignore
    if (resRanges.length > 0) res.clients.set(client, /** @type {any} */ (new Ranges(resRanges)))
  })
  return res
}

/**
 * Remove all ranges from `exclude` from `idSet`. The result is a fresh IdSet containing all ranges from `idSet` that are not
 * in `exclude`.
 *
 * @type {(idSet: IdSet, exclude: IdSet|IdMap<any>) => IdSet}
 */
export const diffIdSet = _diffSet

/**
 * @template {IdSet | IdMap<any>} SetA
 * @template {IdSet | IdMap<any>} SetB
 * @param {SetA} setA
 * @param {SetB} setB
 * @return {SetA extends IdMap<infer A> ? (SetB extends IdMap<infer B> ? IdMap<A | B> : IdMap<A>) : IdSet}
 */
export const _intersectSets = (setA, setB) => {
  /**
   * @type {IdMap<any> | IdSet}
   */
  const res = /** @type {any } */ (setA instanceof IdSet ? new IdSet() : new IdMap())
  const Ranges = setA instanceof IdSet ? IdRanges : AttrRanges
  setA.clients.forEach((_aRanges, client) => {
    /**
     * @type {Array<IdRange>}
     */
    const resRanges = []
    const _bRanges = setB.clients.get(client)
    const aRanges = _aRanges.getIds()
    if (_bRanges != null) {
      const bRanges = _bRanges.getIds()
      for (let a = 0, b = 0; a < aRanges.length && b < bRanges.length;) {
        const aRange = aRanges[a]
        const bRange = bRanges[b]
        // construct overlap
        const clock = math.max(aRange.clock, bRange.clock)
        const len = math.min(aRange.len - (clock - aRange.clock), bRange.len - (clock - bRange.clock))
        if (len > 0) {
          resRanges.push(aRange instanceof AttrRange
            ? new AttrRange(clock, len, /** @type {Array<AttributionItem<any>>} */ (aRange.attrs).concat(bRange.attrs))
            : new IdRange(clock, len)
          )
        }
        if (aRange.clock + aRange.len < bRange.clock + bRange.len) {
          a++
        } else {
          b++
        }
      }
    }
    // @ts-ignore
    if (resRanges.length > 0) res.clients.set(client, /** @type {any} */ (new Ranges(resRanges)))
  })
  return /** @type {any} */ (res)
}

export const intersectSets = _intersectSets

/**
 * @param {IdSet} idSet
 * @param {number} client
 * @param {number} clock
 * @param {number} length
 *
 * @private
 * @function
 */
export const addToIdSet = (idSet, client, clock, length) => {
  if (length === 0) return
  const idRanges = idSet.clients.get(client)
  if (idRanges) {
    idRanges.add(clock, length)
  } else {
    idSet.clients.set(client, new IdRanges([new IdRange(clock, length)]))
  }
}

/**
 * @param {IdSet} idSet
 * @param {AbstractStruct} struct
 *
 * @private
 * @function
 */
export const addStructToIdSet = (idSet, struct) => addToIdSet(idSet, struct.id.client, struct.id.clock, struct.length)

export const createIdSet = () => new IdSet()

/**
 * @param {StructStore} ss
 * @return {IdSet}
 *
 * @private
 * @function
 */
export const createDeleteSetFromStructStore = ss => {
  const ds = createIdSet()
  ss.clients.forEach((structs, client) => {
    /**
     * @type {Array<IdRange>}
     */
    const dsitems = []
    for (let i = 0; i < structs.length; i++) {
      const struct = structs[i]
      if (struct.deleted) {
        const clock = struct.id.clock
        let len = struct.length
        if (i + 1 < structs.length) {
          for (let next = structs[i + 1]; i + 1 < structs.length && next.deleted; next = structs[++i + 1]) {
            len += next.length
          }
        }
        dsitems.push(new IdRange(clock, len))
      }
    }
    if (dsitems.length > 0) {
      ds.clients.set(client, new IdRanges(dsitems))
    }
  })
  return ds
}

/**
 * @param {import('../internals.js').StructStore} ss
 * @param {boolean} filterDeleted
 */
export const createInsertionSetFromStructStore = (ss, filterDeleted) => {
  const idset = createIdSet()
  ss.clients.forEach((structs, client) => {
    /**
     * @type {Array<IdRange>}
     */
    const iditems = []
    for (let i = 0; i < structs.length; i++) {
      const struct = structs[i]
      if (!(filterDeleted && struct.deleted)) {
        const clock = struct.id.clock
        let len = struct.length
        if (i + 1 < structs.length) {
          // eslint-disable-next-line
          for (let next = structs[i + 1]; i + 1 < structs.length && !(filterDeleted && next.deleted); next = structs[++i + 1]) {
            len += next.length
          }
        }
        iditems.push(new IdRange(clock, len))
      }
    }
    if (iditems.length > 0) {
      idset.clients.set(client, new IdRanges(iditems))
    }
  })
  return idset
}

/**
 * @param {IdSetEncoderV1 | IdSetEncoderV2} encoder
 * @param {IdSet} idSet
 *
 * @private
 * @function
 */
export const writeIdSet = (encoder, idSet) => {
  encoding.writeVarUint(encoder.restEncoder, idSet.clients.size)
  // Ensure that the delete set is written in a deterministic order
  array.from(idSet.clients.entries())
    .sort((a, b) => b[0] - a[0])
    .forEach(([client, _idRanges]) => {
      const idRanges = _idRanges.getIds()
      encoder.resetIdSetCurVal()
      encoding.writeVarUint(encoder.restEncoder, client)
      const len = idRanges.length
      encoding.writeVarUint(encoder.restEncoder, len)
      for (let i = 0; i < len; i++) {
        const item = idRanges[i]
        encoder.writeIdSetClock(item.clock)
        encoder.writeIdSetLen(item.len)
      }
    })
}

/**
 * @param {DSDecoderV1 | DSDecoderV2} decoder
 * @return {IdSet}
 *
 * @private
 * @function
 */
export const readIdSet = decoder => {
  const ds = new IdSet()
  const numClients = decoding.readVarUint(decoder.restDecoder)
  for (let i = 0; i < numClients; i++) {
    decoder.resetDsCurVal()
    const client = decoding.readVarUint(decoder.restDecoder)
    const numberOfDeletes = decoding.readVarUint(decoder.restDecoder)
    if (numberOfDeletes > 0) {
      /**
       * @type {Array<IdRange>}
       */
      const dsRanges = []
      for (let i = 0; i < numberOfDeletes; i++) {
        dsRanges.push(new IdRange(decoder.readDsClock(), decoder.readDsLen()))
      }
      ds.clients.set(client, new IdRanges(dsRanges))
    }
  }
  return ds
}

/**
 * @todo YDecoder also contains references to String and other Decoders. Would make sense to exchange YDecoder.toUint8Array for YDecoder.DsToUint8Array()..
 */

/**
 * @param {DSDecoderV1 | DSDecoderV2} decoder
 * @param {Transaction} transaction
 * @param {StructStore} store
 * @return {Uint8Array|null} Returns a v2 update containing all deletes that couldn't be applied yet; or null if all deletes were applied successfully.
 *
 * @private
 * @function
 */
export const readAndApplyDeleteSet = (decoder, transaction, store) => {
  const unappliedDS = new IdSet()
  const numClients = decoding.readVarUint(decoder.restDecoder)
  for (let i = 0; i < numClients; i++) {
    decoder.resetDsCurVal()
    const client = decoding.readVarUint(decoder.restDecoder)
    const numberOfDeletes = decoding.readVarUint(decoder.restDecoder)
    const structs = store.clients.get(client) || []
    const state = getState(store, client)
    for (let i = 0; i < numberOfDeletes; i++) {
      const clock = decoder.readDsClock()
      const clockEnd = clock + decoder.readDsLen()
      if (clock < state) {
        if (state < clockEnd) {
          addToIdSet(unappliedDS, client, state, clockEnd - state)
        }
        let index = findIndexSS(structs, clock)
        /**
         * We can ignore the case of GC and Delete structs, because we are going to skip them
         * @type {Item}
         */
        // @ts-ignore
        let struct = structs[index]
        // split the first item if necessary
        if (!struct.deleted && struct.id.clock < clock) {
          structs.splice(index + 1, 0, splitItem(transaction, struct, clock - struct.id.clock))
          index++ // increase we now want to use the next struct
        }
        while (index < structs.length) {
          // @ts-ignore
          struct = structs[index++]
          if (struct.id.clock < clockEnd) {
            if (!struct.deleted) {
              if (clockEnd < struct.id.clock + struct.length) {
                structs.splice(index, 0, splitItem(transaction, struct, clockEnd - struct.id.clock))
              }
              struct.delete(transaction)
            }
          } else {
            break
          }
        }
      } else {
        addToIdSet(unappliedDS, client, clock, clockEnd - clock)
      }
    }
  }
  if (unappliedDS.clients.size > 0) {
    const ds = new UpdateEncoderV2()
    encoding.writeVarUint(ds.restEncoder, 0) // encode 0 structs
    writeIdSet(ds, unappliedDS)
    return ds.toUint8Array()
  }
  return null
}

/**
 * @param {IdSet} ds1
 * @param {IdSet} ds2
 */
export const equalIdSets = (ds1, ds2) => {
  if (ds1.clients.size !== ds2.clients.size) return false
  for (const [client, _deleteItems1] of ds1.clients.entries()) {
    const deleteItems1 = _deleteItems1.getIds()
    const deleteItems2 = ds2.clients.get(client)?.getIds()
    if (deleteItems2 === undefined || deleteItems1.length !== deleteItems2.length) return false
    for (let i = 0; i < deleteItems1.length; i++) {
      const di1 = deleteItems1[i]
      const di2 = deleteItems2[i]
      if (di1.clock !== di2.clock || di1.len !== di2.len) {
        return false
      }
    }
  }
  return true
}
