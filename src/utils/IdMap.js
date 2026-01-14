import {
  _diffSet,
  findIndexInIdRanges,
  findRangeStartInIdRanges,
  _deleteRangeFromIdSet,
  IdSetDecoderV1, IdSetDecoderV2,  IdSetEncoderV1, IdSetEncoderV2, IdSet, ID, // eslint-disable-line
  _insertIntoIdSet,
  _intersectSets,
  createIdSet,
  IdRanges
} from '../internals.js'

import * as array from 'lib0/array'
import * as map from 'lib0/map'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as buf from 'lib0/buffer'
import * as rabin from 'lib0/hash/rabin'

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
 * @template T
 * @param {Array<T>} a
 * @param {Array<T>} b
 */
const idmapAttrRangeJoin = (a, b) => a.concat(b.filter(attr => !idmapAttrsHas(a, attr)))

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
 * @template T
 * @param {IdMap<T>} dest
 * @param {IdMap<T>} src
 */
export const insertIntoIdMap = _insertIntoIdSet

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
