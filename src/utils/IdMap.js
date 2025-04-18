import {
  _diffSet,
  findIndexInIdRanges,
  IdSet, ID // eslint-disable-line
} from '../internals.js'

import * as array from 'lib0/array'
import * as map from 'lib0/map'
import * as encoding from 'lib0/encoding'
import * as buf from 'lib0/buffer'
import * as rabin from 'lib0/hash/rabin'

/**
 * @template V
 */
export class Attribution {
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
 * @param {Attribution<any>} attr
 */
const _hashAttribution = attr => {
  const encoder = encoding.createEncoder()
  encoding.writeVarString(encoder, attr.name)
  encoding.writeAny(encoder, attr.val)
  return buf.toBase64(rabin.fingerprint(rabin.StandardIrreducible128, encoding.toUint8Array(encoder)))
}


/**
 * @template V
 * @param {string} name
 * @param {V} val
 * @return {Attribution<V>}
 */
export const createAttribution = (name, val) => new Attribution(name, val)

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
   * @param {Array<Attribution<Attrs>>} attrs
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

  /**
   * @param {number} clock
   * @param {number} length
   * @param {Array<Attribution<Attrs>>} attrs
   */
  add (clock, length, attrs) {
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
   * @type {Map<Attribution<any>,Attribution<any>>}
   */
  const attrMapper = new Map()
  const merged = createIdMap()
  for (let amsI = 0; amsI < ams.length; amsI++) {
    ams[amsI].clients.forEach((rangesLeft, client) => {
      if (!merged.clients.has(client)) {
        // Write all missing keys from current set and all following.
        // If merged already contains `client` current ds has already been added.
        const ids = rangesLeft.getIds().slice()
        for (let i = amsI + 1; i < ams.length; i++) {
          const nextIds = ams[i].clients.get(client)
          if (nextIds) {
            array.appendTo(ids, nextIds.getIds())
          }
        }
        ids.forEach(id => {
          // @ts-ignore
          id.attrs = id.attrs.map(attr =>
            map.setIfUndefined(attrMapper, attr, () =>
              _ensureAttrs(merged, [attr])[0]
            )
          )
        })
        merged.clients.set(client, new AttrRanges(ids))
      }
    })
  }
  return merged
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
     * @type {Map<string, Attribution<Attrs>>}
     */
    this.attrsH = new Map()
    /**
     * @type {Set<Attribution<Attrs>>}
     */
    this.attrs = new Set()
  }

  /**
   * @param {ID} id
   * @return {boolean}
   */
  has (id) {
    const dr = this.clients.get(id.client)
    if (dr) {
      return findIndexInIdRanges(dr.getIds(), id.clock) !== null
    }
    return false
  }

  /**
   * @param {ID} id
   * @param {number} len
   * @return {Array<AttrRange<Attrs>>?}
   */
  slice (id, len) {
    const dr = this.clients.get(id.client)
    if (dr) {
      /**
       * @type {Array<AttrRange<Attrs>>}
       */
      const ranges = dr.getIds()
      let index = findIndexInIdRanges(ranges, id.clock)
      if (index !== null) {
        const res = []
        while (index < ranges.length) {
          let r = ranges[index]
          if (r.clock < id.clock) {
            r = new AttrRange(id.clock, r.len - (id.clock - r.clock), r.attrs)
          }
          if (r.clock + r.len > id.clock + len) {
            r = new AttrRange(r.clock, id.clock + len - r.clock, r.attrs)
          }
          if (r.len <= 0) break
          res.push(r)
          index++
        }
        return res
      }
    }
    return null
  }

  /**
   * @param {number} client
   * @param {number} clock
   * @param {number} len
   * @param {Array<Attribution<Attrs>>} attrs
   */
  add (client, clock, len, attrs) {
    attrs = _ensureAttrs(this, attrs)
    const ranges = this.clients.get(client)
    if (ranges == null) {
      this.clients.set(client, new AttrRanges([new AttrRange(clock, len, attrs)]))
    } else {
      ranges.add(clock, len, attrs)
    }
  }
}

/**
 * @template Attrs
 * @param {IdMap<Attrs>} idmap
 * @param {Array<Attribution<Attrs>>} attrs
 * @return {Array<Attribution<Attrs>>}
 */
const _ensureAttrs = (idmap, attrs) => attrs.map(attr =>
  idmap.attrs.has(attr) ? attr : map.setIfUndefined(idmap.attrsH, _hashAttribution(attr), () => {
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
export const diffIdMap = _diffSet
