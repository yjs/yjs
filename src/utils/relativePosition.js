
import {
  find,
  exists,
  getItemType,
  createID,
  writeID,
  readID,
  compareIDs,
  findRootTypeKey,
  AbstractItem,
  ID, StructStore, Y, AbstractType // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import * as error from 'lib0/error.js'

/**
 * A relative position that is based on the Yjs model. In contrast to an
 * absolute position (position by index), the relative position can be
 * recomputed when remote changes are received. For example:
 *
 * ```Insert(0, 'x')('a|bc') = 'xa|bc'``` Where | is the cursor position.
 *
 * A relative cursor position can be obtained with the function
 * {@link getRelativePosition} and it can be transformed to an absolute position
 * with {@link fromRelativePosition}.
 *
 * One of the properties must be defined.
 *
 * @example
 * // Current cursor position is at position 10
 * let relativePosition = getRelativePosition(yText, 10)
 * // modify yText
 * yText.insert(0, 'abc')
 * yText.delete(3, 10)
 * // Compute the cursor position
 * let absolutePosition = fromRelativePosition(y, relativePosition)
 * absolutePosition.type // => yText
 * console.log('cursor location is ' + absolutePosition.offset) // => cursor location is 3
 *
 */
export class RelativePosition {
  /**
   * @param {ID|null} type
   * @param {string|null} tname
   * @param {ID|null} item
   */
  constructor (type, tname, item) {
    /**
     * @type {ID|null}
     */
    this.type = type
    /**
     * @type {string|null}
     */
    this.tname = tname
    /**
     * @type {ID | null}
     */
    this.item = item
  }
}

export class AbsolutePosition {
  /**
   * @param {AbstractType<any>} type
   * @param {number} offset
   */
  constructor (type, offset) {
    /**
     * @type {AbstractType<any>}
     */
    this.type = type
    /**
     * @type {number}
     */
    this.offset = offset
  }
}

/**
 * @param {AbstractType<any>} type
 * @param {number} offset
 */
export const createAbsolutePosition = (type, offset) => new AbsolutePosition(type, offset)

/**
 * @param {AbstractType<any>} type
 * @param {ID|null} item
 */
export const createRelativePosition = (type, item) => {
  let typeid = null
  let tname = null
  if (type._item === null) {
    tname = findRootTypeKey(type)
  } else {
    typeid = type._item.id
  }
  return new RelativePosition(typeid, tname, item)
}

/**
 * Create a relativePosition based on a absolute position.
 *
 * @param {AbstractType<any>} type The base type (e.g. YText or YArray).
 * @param {number} offset The absolute position.
 * @return {RelativePosition}
 */
export const createRelativePositionByOffset = (type, offset) => {
  let t = type._start
  while (t !== null) {
    if (!t.deleted && t.countable) {
      if (t.length > offset) {
        // case 1: found position somewhere in the linked list
        return createRelativePosition(type, createID(t.id.client, t.id.clock + offset))
      }
      offset -= t.length
    }
    t = t.right
  }
  return createRelativePosition(type, null)
}

/**
 * @param {encoding.Encoder} encoder
 * @param {RelativePosition} rpos
 */
export const writeRelativePosition = (encoder, rpos) => {
  const { type, tname, item } = rpos
  if (item !== null) {
    encoding.writeVarUint(encoder, 0)
    writeID(encoder, item)
  } else if (tname !== null) {
    // case 2: found position at the end of the list and type is stored in y.share
    encoding.writeUint8(encoder, 1)
    encoding.writeVarString(encoder, tname)
  } else if (type !== null) {
    // case 3: found position at the end of the list and type is attached to an item
    encoding.writeUint8(encoder, 2)
    writeID(encoder, type)
  } else {
    throw error.unexpectedCase()
  }
  return encoder
}

/**
 * @param {decoding.Decoder} decoder
 * @param {Y} y
 * @param {StructStore} store
 * @return {RelativePosition|null}
 */
export const readRelativePosition = (decoder, y, store) => {
  let type = null
  let tname = null
  let itemID = null
  switch (decoding.readVarUint(decoder)) {
    case 0:
      // case 1: found position somewhere in the linked list
      itemID = readID(decoder)
      break
    case 1:
      // case 2: found position at the end of the list and type is stored in y.share
      tname = decoding.readVarString(decoder)
      break
    case 2: {
      // case 3: found position at the end of the list and type is attached to an item
      type = readID(decoder)
    }
  }
  return new RelativePosition(type, tname, itemID)
}

/**
 * @param {RelativePosition} rpos
 * @param {StructStore} store
 * @param {Y} y
 * @return {AbsolutePosition|null}
 */
export const toAbsolutePosition = (rpos, store, y) => {
  const rightID = rpos.item
  const typeID = rpos.type
  const tname = rpos.tname
  let type = null
  let offset = 0
  if (rightID !== null) {
    if (!exists(store, rightID)) {
      return null
    }
    const right = find(store, rightID)
    if (!(right instanceof AbstractItem)) {
      return null
    }
    offset = right.deleted ? 0 : rightID.clock - right.id.clock
    let n = right.left
    while (n !== null) {
      if (!n.deleted && n.countable) {
        offset += n.length
      }
      n = n.left
    }
    type = right.parent
  } else {
    if (tname !== null) {
      type = y.get(tname)
    } else if (typeID !== null) {
      type = getItemType(store, typeID).type
    } else {
      throw error.unexpectedCase()
    }
    offset = type._length
  }
  if (type._item !== null && type._item.deleted) {
    return null
  }
  return createAbsolutePosition(type, offset)
}

/**
 * Transforms an absolute to a relative position.
 *
 * @param {AbsolutePosition} apos The absolute position.
 * @param {Y} y The Yjs instance in which to query for the absolute position.
 * @return {RelativePosition} The absolute position in the Yjs model
 *                            (type + offset).
 */
export const toRelativePosition = (apos, y) => {
  const type = apos.type
  if (type._length === apos.offset) {
    return createRelativePosition(type, null)
  } else {
    let offset = apos.offset
    let n = type._start
    while (n !== null) {
      if (!n.deleted && n.countable) {
        if (n.length > offset) {
          return createRelativePosition(type, createID(n.id.client, n.id.clock + offset))
        }
        offset -= n.length
      }
      n = n.right
    }
  }
  throw error.unexpectedCase()
}

/**
 * @param {RelativePosition|null} a
 * @param {RelativePosition|null} b
 */
export const compareRelativePositions = (a, b) => a === b || (
  a !== null && b !== null && (
    (a.item !== null && b.item !== null && compareIDs(a.item, b.item)) ||
    (a.tname !== null && a.tname === b.tname) ||
    (a.type !== null && b.type !== null && compareIDs(a.type, b.type))
  )
)
