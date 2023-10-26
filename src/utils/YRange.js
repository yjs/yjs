import {
  createID,
  findMarker,
  createRelativePosition,
  AbstractType, RelativePosition, Item // eslint-disable-line
} from '../internals.js'

/**
 * Object which describes bounded range of elements, together with inclusivity/exclusivity rules
 * operating over that range.
 *
 * These inclusivity rules bear extra meaning when it comes to concurrent inserts, that may
 * eventually happen ie. range `[1..2]` (both side inclusive) means that if a concurrent insert
 * would happen at the boundary between 2nd and 3rd index, it should **NOT** be a part of that
 * range, while range definition `[1..3)` (right side is open) while still describing similar
 * range in linear collection, would also span the range over the elements inserted concurrently
 * between 2nd and 3rd indexes.
 */
export class YRange {
  // API mirrored after: https://www.w3.org/TR/IndexedDB/#idbkeyrange

  /**
   *
   * @param {number|null} lower a lower bound of a range (cannot be higher than upper)
   * @param {number|null} upper an upper bound of a range (cannot be less than lower)
   * @param {boolean} lowerOpen if `true` lower is NOT included in the range
   * @param {boolean} upperOpen if `true` upper is NOT included in the range
   */
  constructor (lower, upper, lowerOpen = false, upperOpen = false) {
    if (lower !== null && upper !== null && lower > upper) {
      throw new Error('Invalid range: lower bound is higher than upper bound')
    }
    /**
     * A lower bound of a range (cannot be higher than upper). Null if unbounded.
     * @type {number|null}
     */
    this.lower = lower
    /**
     * An upper bound of a range (cannot be less than lower). Null if unbounded.
     * @type {number|null}
     */
    this.upper = upper
    /**
     * If `true` lower is NOT included in the range.
     * @type {boolean}
     */
    this.lowerOpen = lowerOpen
    /**
     * If `true` upper is NOT included in the range.
     * @type {boolean}
     */
    this.upperOpen = upperOpen
  }

  /**
   * Creates a range that only spans over a single element.
   *
   * @param {number} index
   * @returns {YRange}
   */
  static only (index) {
    return new YRange(index, index)
  }

  /**
   * Returns a range instance, that's bounded on the lower side and
   * unbounded on the upper side.
   *
   * @param {number} lower a lower bound of a range
   * @param {boolean} lowerOpen if `true` lower is NOT included in the range
   * @returns {YRange}
   */
  static lowerBound (lower, lowerOpen = false) {
    return new YRange(lower, null, lowerOpen, false)
  }

  /**
   * Returns a range instance, that's unbounded on the lower side and
   * bounded on the upper side.
   *
   * @param {number} upper an upper bound of a range
   * @param {boolean} upperOpen if `true` upper is NOT included in the range
   * @returns {YRange}
   */
  static upperBound (upper, upperOpen = false) {
    return new YRange(null, upper, false, upperOpen)
  }

  /**
   * Creates a new range instance, bounded on both ends.
   *
   * @param {number} lower a lower bound of a range (cannot be higher than upper)
   * @param {number} upper an upper bound of a range (cannot be less than lower)
   * @param {boolean} lowerOpen if `true` lower is NOT included in the range
   * @param {boolean} upperOpen if `true` upper is NOT included in the range
   */
  static bound (lower, upper, lowerOpen = false, upperOpen = false) {
    return new YRange(lower, upper, lowerOpen, upperOpen)
  }

  /**
   * Checks if a provided index is included in current range.
   *
   * @param {number} index
   * @returns {boolean}
   */
  includes (index) {
    if (this.lower !== null && index < this.lower) {
      return false
    }
    if (this.upper !== null && index > this.upper) {
      return false
    }
    if (index === this.lower) {
      return !this.lowerOpen
    }
    if (index === this.upper) {
      return !this.upperOpen
    }
    return true
  }
}

const indexOutOfBounds = new Error('index out of bounds')

/**
 *
 * @param {AbstractType<any>} type
 * @param {number} index
 * @returns {{item: Item,index:number}|null}
 */
const findPosition = (type, index) => {
  if (type._searchMarker !== null) {
    const marker = findMarker(type, index)
    if (marker !== null) {
      return { item: marker.p, index: marker.index }
    } else {
      return null
    }
  } else {
    let remaining = index
    let item = type._start
    for (; item !== null && remaining > 0; item = item.right) {
      if (!item.deleted && item.countable) {
        if (remaining < item.length) {
          break
        }
        remaining -= item.length
      }
    }
    if (item === null) {
      return null
    } else {
      return { item, index: index - remaining }
    }
  }
}

/**
 * Returns a pair of values representing relative IDs of a range.
 *
 * @param {AbstractType<any>} type collection that range relates to
 * @param {YRange} range
 * @returns {RelativePosition[]}
 * @throws Will throw an error, if range indexes are out of an type's bounds.
 */
export const rangeToRelative = (type, range) => {
  /** @type {RelativePosition} */
  let start
  /** @type {RelativePosition} */
  let end
  let item = type._start
  let remaining = 0
  if (range.lower !== null) {
    remaining = range.lower
    if (remaining === 0 && item !== null) {
      start = createRelativePosition(type, item.id, range.lowerOpen ? 0 : -1)
    } else {
      const pos = findPosition(type, remaining)
      if (pos !== null) {
        item = pos.item
        remaining -= pos.index
        start = createRelativePosition(type, createID(pos.item.id.client, pos.item.id.clock + remaining), range.lowerOpen ? 0 : -1)
      } else {
        throw indexOutOfBounds
      }
    }
  } else {
    // left-side unbounded
    start = createRelativePosition(type, null, -1)
  }

  if (range.upper !== null) {
    remaining = range.upper - (range.lower ?? 0) + remaining
    while (item !== null) {
      if (!item.deleted && item.countable) {
        if (item.length > remaining) {
          break
        }
        remaining -= item.length
      }
      item = item.right
    }
    if (item === null) {
      throw indexOutOfBounds
    } else {
      end = createRelativePosition(type, createID(item.id.client, item.id.clock + remaining), range.upperOpen ? -1 : 0)
    }
  } else {
    // right-side unbounded
    end = createRelativePosition(type, null, 0)
  }
  return [start, end]
}
