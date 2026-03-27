import * as math from 'lib0/math'
import * as traits from 'lib0/traits'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as buf from 'lib0/buffer'
import * as rabin from 'lib0/hash/rabin'
import * as array from 'lib0/array'
import * as map from 'lib0/map'

import { iterateStructs, findIndexSS } from './transaction-helpers.js'
import { UpdateEncoderV2, IdSetEncoderV2 } from './UpdateEncoder.js'
import { IdSetDecoderV2 } from './UpdateDecoder.js'

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
   * @return {Array<ContentAttribute<any>>}
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

export class IdRanges {
  /**
   * @param {Array<IdRange>} ids
   */
  constructor (ids) {
    this.sorted = false
    /**
     * A typical use-case for IdSet is to append data. We heavily optimize this case by allowing the
     * last item to be mutated ef it isn't used currently.
     * This flag is true if the last item was exposed to the outside.
     */
    this._lastIsUsed = false
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
    if (last != null && last.clock + last.len === clock) {
      if (this._lastIsUsed) {
        this._ids[this._ids.length - 1] = new IdRange(last.clock, last.len + length)
        this._lastIsUsed = false
      } else {
        this._ids[this._ids.length - 1].len += length
      }
    } else {
      this.sorted = false
      this._ids.push(new IdRange(clock, length))
    }
  }

  /**
   * Return the list of immutable id ranges, sorted and merged.
   */
  getIds () {
    const ids = this._ids
    this._lastIsUsed = true
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

/**
 * @implements {traits.EqualityTrait}
 */
export class IdSet {
  constructor () {
    /**
     * @type {Map<number,IdRanges>}
     */
    this.clients = new Map()
  }

  isEmpty () {
    return this.clients.size === 0
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
    if (len === 0) return
    const idRanges = this.clients.get(client)
    if (idRanges) {
      idRanges.add(clock, len)
    } else {
      this.clients.set(client, new IdRanges([new IdRange(clock, len)]))
    }
  }

  /**
   * @param {number} client
   * @param {number} clock
   * @param {number} len
   */
  delete (client, clock, len) {
    _deleteRangeFromIdSet(this, client, clock, len)
  }

  /**
   * @param {any} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return equalIdSets(this, other)
  }
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
const _insertIntoIdSet = (dest, src) => {
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
 * @param {IdMap<any>} dest
 * @param {IdMap<any>|IdSet} src
 */
export const insertIntoIdMap = _insertIntoIdSet

/**
 * @todo rename to excludeIdSet | excludeIdMap
 *
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
            ? new AttrRange(clock, len, /** @type {Array<any>} */ (aRange.attrs).concat(bRange.attrs))
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
 * @param {Array<GC | Item | Skip>} structs
 * @param {boolean} filterDeleted
 *
 */
export const _createInsertSliceFromStructs = (structs, filterDeleted) => {
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
  return iditems
}

/**
 * @param {StructStore} ss
 * @param {boolean} filterDeleted
 */
export const createInsertSetFromStructStore = (ss, filterDeleted) => {
  const idset = createIdSet()
  ss.clients.forEach((structs, client) => {
    const iditems = _createInsertSliceFromStructs(structs, filterDeleted)
    if (iditems.length !== 0) {
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
 * @param {IdSetDecoderV1 | IdSetDecoderV2} decoder
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
 * @param {IdSetDecoderV1 | IdSetDecoderV2} decoder
 * @param {Transaction} transaction
 * @param {StructStore} store
 * @return {Uint8Array<ArrayBuffer>|null} Returns a v2 update containing all deletes that couldn't be applied yet; or null if all deletes were applied successfully.
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
    const state = store.getClock(client)
    for (let i = 0; i < numberOfDeletes; i++) {
      const clock = decoder.readDsClock()
      const clockEnd = clock + decoder.readDsLen()
      if (clock < state) {
        if (state < clockEnd) {
          unappliedDS.add(client, state, clockEnd - state)
        }
        let index = findIndexSS(structs, clock)
        /**
         * We can ignore the case of GC and Delete structs, because we are going to skip them
         * @type {Item | GC | Skip}
         */
        let struct = structs[index]
        // split the first item if necessary
        if (!struct.deleted && struct.id.clock < clock && struct.isItem) {
          // increment index, we now want to use the next struct
          structs.splice(++index, 0, /** @type {Item} */ (struct).split(transaction, clock - struct.id.clock))
        }
        while (index < structs.length) {
          // @ts-ignore
          struct = structs[index++]
          if (struct.id.clock < clockEnd) {
            if (!struct.deleted) {
              if (struct.isItem) {
                if (clockEnd < struct.id.clock + struct.length) {
                  structs.splice(index, 0, /** @type {Item} */ (struct).split(transaction, clockEnd - struct.id.clock))
                }
                struct.delete(transaction)
              } else { // is a Skip - add range to unappliedDS
                const c = math.max(struct.id.clock, clock)
                unappliedDS.add(client, c, math.min(struct.length, clockEnd - c))
              }
            }
          } else {
            break
          }
        }
      } else {
        unappliedDS.add(client, clock, clockEnd - clock)
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
 * @template Attrs
 */
export class AttrRange {
  /**
   * @param {number} clock
   * @param {number} len
   * @param {Array<ContentAttribute<Attrs>>} attrs
   */
  constructor (clock, len, attrs) {
    /**
     * @readonly
     */
    this.clock = clock
    /**
     * @readonly
     */
    this.len = len
    /**
     * @readonly
     */
    this.attrs = attrs
  }

  /**
   * @param {number} clock
   * @param {number} len
   */
  copyWith (clock, len) {
    return new AttrRange(clock, len, this.attrs)
  }
}

/**
 * @todo rename this to `Attribute`
 * @template V
 */
export class ContentAttribute {
  /**
   * @param {string} name
   * @param {V} val
   */
  constructor (name, val) {
    this.name = name
    this.val = val
  }

  hash () {
    const encoder = encoding.createEncoder()
    encoding.writeVarString(encoder, this.name)
    encoding.writeAny(encoder, /** @type {any} */ (this.val))
    return buf.toBase64(rabin.fingerprint(rabin.StandardIrreducible128, encoding.toUint8Array(encoder)))
  }
}

/**
 * @template V
 * @param {string} name
 * @param {V} val
 * @return {ContentAttribute<V>}
 */
export const createContentAttribute = (name, val) => new ContentAttribute(name, val)

/**
 * @template Attrs
 * @typedef {{ clock: number, len: number, attrs: Array<ContentAttribute<Attrs>>? }} MaybeAttrRange
 */

/**
 * @template Attrs
 *
 * @param {number} clock
 * @param {number} len
 * @param {Array<ContentAttribute<Attrs>>?} attrs
 * @return {MaybeAttrRange<Attrs>}
 */
export const createMaybeAttrRange = (clock, len, attrs) => new AttrRange(clock, len, /** @type {any} */ (attrs))

/**
 * @template T
 * @param {Array<T>} a
 * @param {Array<T>} b
 */
const idmapAttrRangeJoin = (a, b) => a.concat(b.filter(attr => !idmapAttrsHas(a, attr)))

/**
 * Whenever this is instantiated, it must receive a fresh array of ops, not something copied.
 *
 * @template Attrs
 */
export class AttrRanges {
  /**
   * @param {Array<AttrRange<Attrs>>} ids
   */
  constructor (ids) {
    this.sorted = false
    /**
     * @private
     */
    this._ids = ids
  }

  copy () {
    return new AttrRanges(this._ids.slice())
  }

  /**
   * @param {number} clock
   * @param {number} length
   * @param {Array<ContentAttribute<Attrs>>} attrs
   */
  add (clock, length, attrs) {
    if (length === 0) return
    this.sorted = false
    this._ids.push(new AttrRange(clock, length, attrs))
  }

  /**
   * Return the list of id ranges, sorted and merged.
   */
  getIds () {
    const ids = this._ids
    if (!this.sorted) {
      this.sorted = true
      ids.sort((a, b) => a.clock - b.clock)
      /**
       * algorithm thoughts:
       * - sort (by clock AND by length), bigger length is to the right (or not, we can't make
       *   assumptions abouth length after long length has been split)
       * -- maybe better: sort by clock+length. Then split items from right to left. This way, items are always
       *   in the right order. But I also need to swap if left items is smaller after split
       *   --- thought: there is no way to go around swapping. Unless, for each item from left to
       *   right, when I have to split because one of the look-ahead items is overlapping, i split
       *   it and merge the attributes into the following ones (that I also need to split). Best is
       *   probably left to right with lookahead.
       * - left to right, split overlapping items so that we can make the assumption that either an
       *   item is overlapping with the next 1-on-1 or it is not overlapping at all (when splitting,
       *   we can already incorporate the attributes)
       *   -- better: for each item, go left to right and add own attributes to overlapping items.
       *   Split them if necessary. After split, i must insert the retainer at a valid position.
       * - merge items if neighbor has same attributes
       */
      for (let i = 0; i < ids.length - 1;) {
        const range = ids[i]
        const nextRange = ids[i + 1]
        // find out how to split range. it must match with next range.
        // 1) we have space. Split if necessary.
        // 2) concat attributes in range to the next range. Split range and splice the remainder at
        // the correct position.
        if (range.clock < nextRange.clock) { // might need to split range
          if (range.clock + range.len > nextRange.clock) {
            // is overlapping
            const diff = nextRange.clock - range.clock
            ids[i] = new AttrRange(range.clock, diff, range.attrs)
            ids.splice(i + 1, 0, new AttrRange(nextRange.clock, range.len - diff, range.attrs))
          }
          i++
          continue
        }
        // now we know that range.clock === nextRange.clock
        // merge range with nextRange
        const largerRange = range.len > nextRange.len ? range : nextRange
        const smallerLen = range.len < nextRange.len ? range.len : nextRange.len
        ids[i] = new AttrRange(range.clock, smallerLen, idmapAttrRangeJoin(range.attrs, nextRange.attrs))
        if (range.len === nextRange.len) {
          ids.splice(i + 1, 1)
        } else {
          ids[i + 1] = new AttrRange(range.clock + smallerLen, largerRange.len - smallerLen, largerRange.attrs)
          array.bubblesortItem(ids, i + 1, (a, b) => a.clock - b.clock)
        }
        if (smallerLen === 0) i++
      }
      while (ids.length > 0 && ids[0].len === 0) {
        ids.splice(0, 1)
      }
      // merge items without filtering or splicing the array.
      // i is the current pointer
      // j refers to the current insert position for the pointed item
      // try to merge dels[i] into dels[j-1] or set dels[j]=dels[i]
      let i, j
      for (i = 1, j = 1; i < ids.length; i++) {
        const left = ids[j - 1]
        const right = ids[i]
        if (left.clock + left.len === right.clock && idmapAttrsEqual(left.attrs, right.attrs)) {
          ids[j - 1] = new AttrRange(left.clock, left.len + right.len, left.attrs)
        } else if (right.len !== 0) {
          if (j < i) {
            ids[j] = right
          }
          j++
        }
      }
      ids.length = ids.length === 0 ? 0 : (ids[j - 1].len === 0 ? j - 1 : j)
    }
    return ids
  }
}

/**
 * @template Attrs
 */
export class IdMap {
  constructor () {
    /**
     * @type {Map<number,AttrRanges<Attrs>>}
     */
    this.clients = new Map()
    /**
     * @type {Map<string, ContentAttribute<Attrs>>}
     */
    this.attrsH = new Map()
    /**
     * @type {Set<ContentAttribute<Attrs>>}
     */
    this.attrs = new Set()
  }

  /**
   * @param {(attrRange:AttrRange<Attrs>, client:number) => void} f
   */
  forEach (f) {
    this.clients.forEach((ranges, client) => {
      ranges.getIds().forEach((range) => {
        f(range, client)
      })
    })
  }

  isEmpty () {
    return this.clients.size === 0
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
   * @return {boolean}
   */
  has (client, clock) {
    const dr = this.clients.get(client)
    if (dr) {
      return findIndexInIdRanges(dr.getIds(), clock) !== null
    }
    return false
  }

  /**
   * Return attributions for a slice of ids.
   *
   * @param {ID} id
   * @param {number} len
   * @return {Array<MaybeAttrRange<Attrs>>}
   */
  sliceId (id, len) {
    return this.slice(id.client, id.clock, len)
  }

  /**
   * Return attributions for a slice of ids.
   *
   * @param {number} client
   * @param {number} clock
   * @param {number} len
   * @return {Array<MaybeAttrRange<Attrs>>}
   */
  slice (client, clock, len) {
    const dr = this.clients.get(client)
    /**
     * @type {Array<MaybeAttrRange<Attrs>>}
     */
    const res = []
    if (dr) {
      /**
       * @type {Array<AttrRange<Attrs>>}
       */
      const ranges = dr.getIds()
      let index = findRangeStartInIdRanges(ranges, clock)
      if (index !== null) {
        let prev = null
        while (index < ranges.length) {
          let r = ranges[index]
          if (r.clock < clock) {
            r = new AttrRange(clock, r.len - (clock - r.clock), r.attrs)
          }
          if (r.clock + r.len > clock + len) {
            r = new AttrRange(r.clock, clock + len - r.clock, r.attrs)
          }
          if (r.len <= 0) break
          const prevEnd = prev != null ? prev.clock + prev.len : clock
          if (prevEnd < r.clock) {
            res.push(createMaybeAttrRange(prevEnd, r.clock - prevEnd, null))
          }
          prev = r
          res.push(r)
          index++
        }
      }
    }
    if (res.length > 0) {
      const last = res[res.length - 1]
      const end = last.clock + last.len
      if (end < clock + len) {
        res.push(createMaybeAttrRange(end, clock + len - end, null))
      }
    } else {
      res.push(createMaybeAttrRange(clock, len, null))
    }
    return res
  }

  /**
   * @param {number} client
   * @param {number} clock
   * @param {number} len
   * @param {Array<ContentAttribute<Attrs>>} attrs
   */
  add (client, clock, len, attrs) {
    if (len === 0) return
    attrs = _ensureAttrs(this, attrs)
    const ranges = this.clients.get(client)
    if (ranges == null) {
      this.clients.set(client, new AttrRanges([new AttrRange(clock, len, attrs)]))
    } else {
      ranges.add(clock, len, attrs)
    }
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
 * @template T
 * @param {Array<T>} attrs
 * @param {T} attr
 *
 */
const idmapAttrsHas = (attrs, attr) => attrs.find(a => a === attr)

/**
 * @template T
 * @param {Array<T>} a
 * @param {Array<T>} b
 */
export const idmapAttrsEqual = (a, b) => a.length === b.length && a.every(v => idmapAttrsHas(b, v))

/**
 * Merge multiple idmaps. Ensures that there are no redundant attribution definitions (two
 * Attributions that describe the same thing).
 *
 * @template T
 * @param {Array<IdMap<T>>} ams
 * @return {IdMap<T>} A fresh IdSet
 */
export const mergeIdMaps = ams => {
  /**
   * Maps attribution to the attribution of the merged idmap.
   *
   * @type {Map<ContentAttribute<any>,ContentAttribute<any>>}
   */
  const attrMapper = new Map()
  const merged = createIdMap()
  for (let amsI = 0; amsI < ams.length; amsI++) {
    ams[amsI].clients.forEach((rangesLeft, client) => {
      if (!merged.clients.has(client)) {
        // Write all missing keys from current set and all following.
        // If merged already contains `client` current ds has already been added.
        let ids = rangesLeft.getIds().slice()
        for (let i = amsI + 1; i < ams.length; i++) {
          const nextIds = ams[i].clients.get(client)
          if (nextIds) {
            array.appendTo(ids, nextIds.getIds())
          }
        }
        ids = ids.map(id => new AttrRange(id.clock, id.len, id.attrs.map(attr =>
          map.setIfUndefined(attrMapper, attr, () =>
            _ensureAttrs(merged, [attr])[0]
          )
        )))
        merged.clients.set(client, new AttrRanges(ids))
      }
    })
  }
  return merged
}

/**
 * @param {IdSet} idset
 * @param {Array<ContentAttribute<any>>} attrs
 */
export const createIdMapFromIdSet = (idset, attrs) => {
  const idmap = createIdMap()
  // map attrs to idmap
  attrs = _ensureAttrs(idmap, attrs)
  // filter out duplicates
  /**
   * @type {Array<ContentAttribute<any>>}
   */
  const checkedAttrs = []
  attrs.forEach(attr => {
    if (!idmapAttrsHas(checkedAttrs, attr)) {
      checkedAttrs.push(attr)
    }
  })
  idset.clients.forEach((ranges, client) => {
    const attrRanges = new AttrRanges(ranges.getIds().map(range => new AttrRange(range.clock, range.len, checkedAttrs)))
    attrRanges.sorted = true // is sorted because idset is sorted
    idmap.clients.set(client, attrRanges)
  })
  return idmap
}

/**
 * Create an IdSet from an IdMap by stripping the attributes.
 *
 * @param {IdMap<any>} idmap
 * @return {IdSet}
 */
export const createIdSetFromIdMap = idmap => {
  const idset = createIdSet()
  idmap.clients.forEach((ranges, client) => {
    const idRanges = new IdRanges([])
    ranges.getIds().forEach(range => idRanges.add(range.clock, range.len))
    idset.clients.set(client, idRanges)
  })
  return idset
}

/**
 * Efficiently encodes IdMap to a binary form. Ensures that information is de-duplicated when
 * written. Attribute.names are referenced by id. Attributes themselfs are also referenced by id.
 *
 * @template Attr
 * @param {IdSetEncoderV1 | IdSetEncoderV2} encoder
 * @param {IdMap<Attr>} idmap
 *
 * @private
 * @function
 */
export const writeIdMap = (encoder, idmap) => {
  encoding.writeVarUint(encoder.restEncoder, idmap.clients.size)
  let lastWrittenClientId = 0
  /**
   * @type {Map<ContentAttribute<Attr>, number>}
   */
  const visitedAttributions = map.create()
  /**
   * @type {Map<string, number>}
   */
  const visitedAttrNames = map.create()
  // Ensure that the ids are written in a deterministic order (smaller clientids first)
  array.from(idmap.clients.entries())
    .sort((a, b) => a[0] - b[0])
    .forEach(([client, _idRanges]) => {
      const attrRanges = _idRanges.getIds()
      encoder.resetIdSetCurVal()
      const diff = client - lastWrittenClientId
      encoding.writeVarUint(encoder.restEncoder, diff)
      lastWrittenClientId = client
      const len = attrRanges.length
      encoding.writeVarUint(encoder.restEncoder, len)
      for (let i = 0; i < len; i++) {
        const item = attrRanges[i]
        const attrs = item.attrs
        const attrLen = attrs.length
        encoder.writeIdSetClock(item.clock)
        encoder.writeIdSetLen(item.len)
        encoding.writeVarUint(encoder.restEncoder, attrLen)
        for (let j = 0; j < attrLen; j++) {
          const attr = attrs[j]
          const attrId = visitedAttributions.get(attr)
          if (attrId != null) {
            encoding.writeVarUint(encoder.restEncoder, attrId)
          } else {
            const newAttrId = visitedAttributions.size
            visitedAttributions.set(attr, newAttrId)
            encoding.writeVarUint(encoder.restEncoder, newAttrId)
            const attrNameId = visitedAttrNames.get(attr.name)
            // write attr.name
            if (attrNameId != null) {
              encoding.writeVarUint(encoder.restEncoder, attrNameId)
            } else {
              const newAttrNameId = visitedAttrNames.size
              encoding.writeVarUint(encoder.restEncoder, newAttrNameId)
              encoding.writeVarString(encoder.restEncoder, attr.name)
              visitedAttrNames.set(attr.name, newAttrNameId)
            }
            encoding.writeAny(encoder.restEncoder, /** @type {any} */ (attr.val))
          }
        }
      }
    })
}

/**
 * @param {IdMap<any>} idmap
 */
export const encodeIdMap = idmap => {
  const encoder = new IdSetEncoderV2()
  writeIdMap(encoder, idmap)
  return encoder.toUint8Array()
}

/**
 * @param {IdSetDecoderV1 | IdSetDecoderV2} decoder
 * @return {IdMap<any>}
 *
 * @private
 * @function
 */
export const readIdMap = decoder => {
  const idmap = new IdMap()
  const numClients = decoding.readVarUint(decoder.restDecoder)
  /**
   * @type {Array<ContentAttribute<any>>}
   */
  const visitedAttributions = []
  /**
   * @type {Array<string>}
   */
  const visitedAttrNames = []
  let lastClientId = 0
  for (let i = 0; i < numClients; i++) {
    decoder.resetDsCurVal()
    const client = lastClientId + decoding.readVarUint(decoder.restDecoder)
    lastClientId = client
    const numberOfDeletes = decoding.readVarUint(decoder.restDecoder)
    /**
     * @type {Array<AttrRange<any>>}
     */
    const attrRanges = []
    for (let i = 0; i < numberOfDeletes; i++) {
      const rangeClock = decoder.readDsClock()
      const rangeLen = decoder.readDsLen()
      /**
       * @type {Array<ContentAttribute<any>>}
       */
      const attrs = []
      const attrsLen = decoding.readVarUint(decoder.restDecoder)
      for (let j = 0; j < attrsLen; j++) {
        const attrId = decoding.readVarUint(decoder.restDecoder)
        if (attrId >= visitedAttributions.length) {
          // attrId not known yet
          const attrNameId = decoding.readVarUint(decoder.restDecoder)
          if (attrNameId >= visitedAttrNames.length) {
            visitedAttrNames.push(decoding.readVarString(decoder.restDecoder))
          }
          visitedAttributions.push(new ContentAttribute(visitedAttrNames[attrNameId], decoding.readAny(decoder.restDecoder)))
        }
        attrs.push(visitedAttributions[attrId])
      }
      attrRanges.push(new AttrRange(rangeClock, rangeLen, attrs))
    }
    idmap.clients.set(client, new AttrRanges(attrRanges))
  }
  visitedAttributions.forEach(attr => {
    idmap.attrs.add(attr)
    idmap.attrsH.set(attr.hash(), attr)
  })
  return idmap
}

/**
 * @param {Uint8Array} data
 * @return {IdMap<any>}
 */
export const decodeIdMap = data => readIdMap(new IdSetDecoderV2(decoding.createDecoder(data)))

/**
 * @template Attrs
 * @param {IdMap<Attrs>} idmap
 * @param {Array<ContentAttribute<Attrs>>} attrs
 * @return {Array<ContentAttribute<Attrs>>}
 */
const _ensureAttrs = (idmap, attrs) => attrs.map(attr =>
  idmap.attrs.has(attr)
    ? attr
    : map.setIfUndefined(idmap.attrsH, attr.hash(), () => {
      idmap.attrs.add(attr)
      return attr
    }))

export const createIdMap = () => new IdMap()

/**
 * Remove all ranges from `exclude` from `ds`. The result is a fresh IdMap containing all ranges from `idSet` that are not
 * in `exclude`.
 *
 * @template {IdMap<any>} ISet
 * @param {ISet} set
 * @param {IdSet | IdMap<any>} exclude
 * @return {ISet}
 */
export const diffIdMap = (set, exclude) => {
  const diffed = _diffSet(set, exclude)
  diffed.attrs = set.attrs
  diffed.attrsH = set.attrsH
  return diffed
}

export const intersectMaps = _intersectSets

/**
 * Filter attributes in an IdMap based on a predicate function.
 * Returns a new IdMap containing idranges that match the predicate.
 *
 * @template Attrs
 * @param {IdMap<Attrs>} idmap
 * @param {(attr: Array<ContentAttribute<Attrs>>) => boolean} predicate
 * @return {IdMap<Attrs>}
 */
export const filterIdMap = (idmap, predicate) => {
  const filtered = createIdMap()
  idmap.clients.forEach((ranges, client) => {
    /**
     * @type {Array<AttrRange<Attrs>>}
     */
    const attrRanges = []
    ranges.getIds().forEach((range) => {
      if (predicate(range.attrs)) {
        const rangeCpy = range.copyWith(range.clock, range.len)
        attrRanges.push(rangeCpy)
        rangeCpy.attrs.forEach(attr => {
          filtered.attrs.add(attr)
          filtered.attrsH.set(attr.hash(), attr)
        })
      }
    })
    if (attrRanges.length > 0) {
      filtered.clients.set(client, new AttrRanges(attrRanges))
    }
  })
  return filtered
}
