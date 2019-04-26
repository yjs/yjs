/**
 * @module Cursors
 */

import {
  getItem,
  getItemType,
  createID,
  writeID,
  readID,
  compareIDs,
  getState,
  findRootTypeKey,
  AbstractItem,
  ItemType,
  ID, StructStore, Y, AbstractType // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import * as error from 'lib0/error.js'

/**
 * A Cursor is a relative position that is based on the Yjs model. In contrast to an
 * absolute position (position by index), the Cursor can be
 * recomputed when remote changes are received. For example:
 *
 * ```Insert(0, 'x')('a|bc') = 'xa|bc'``` Where | is the cursor position.
 *
 * A relative cursor position can be obtained with the function
 *
 * One of the properties must be defined.
 *
 * @example
 *   // Current cursor position is at position 10
 *   const relativePosition = createCursorFromOffset(yText, 10)
 *   // modify yText
 *   yText.insert(0, 'abc')
 *   yText.delete(3, 10)
 *   // Compute the cursor position
 *   const absolutePosition = toAbsolutePosition(y, relativePosition)
 *   absolutePosition.type === yText // => true
 *   console.log('cursor location is ' + absolutePosition.offset) // => cursor location is 3
 *
 */
export class Cursor {
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
  toJSON () {
    const json = {}
    if (this.type !== null) {
      json.type = this.type.toJSON()
    }
    if (this.tname !== null) {
      json.tname = this.tname
    }
    if (this.item !== null) {
      json.item = this.item.toJSON()
    }
    return json
  }
}

/**
 * @param {Object} json
 * @return {Cursor}
 *
 * @function
 */
export const createCursorFromJSON = json => new Cursor(json.type == null ? null : createID(json.type.client, json.type.clock), json.tname || null, json.item == null ? null : createID(json.item.client, json.item.clock))

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
 *
 * @function
 */
export const createAbsolutePosition = (type, offset) => new AbsolutePosition(type, offset)

/**
 * @param {AbstractType<any>} type
 * @param {ID|null} item
 *
 * @function
 */
export const createCursor = (type, item) => {
  let typeid = null
  let tname = null
  if (type._item === null) {
    tname = findRootTypeKey(type)
  } else {
    typeid = type._item.id
  }
  return new Cursor(typeid, tname, item)
}

/**
 * Create a relativePosition based on a absolute position.
 *
 * @param {AbstractType<any>} type The base type (e.g. YText or YArray).
 * @param {number} offset The absolute position.
 * @return {Cursor}
 *
 * @function
 */
export const createCursorFromTypeOffset = (type, offset) => {
  let t = type._start
  while (t !== null) {
    if (!t.deleted && t.countable) {
      if (t.length > offset) {
        // case 1: found position somewhere in the linked list
        return createCursor(type, createID(t.id.client, t.id.clock + offset))
      }
      offset -= t.length
    }
    t = t.right
  }
  return createCursor(type, null)
}

/**
 * @param {encoding.Encoder} encoder
 * @param {Cursor} rpos
 *
 * @function
 */
export const writeCursor = (encoder, rpos) => {
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
 * @return {Cursor|null}
 *
 * @function
 */
export const readCursor = (decoder, y, store) => {
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
  return new Cursor(type, tname, itemID)
}

/**
 * @param {Cursor} cursor
 * @param {Y} y
 * @return {AbsolutePosition|null}
 *
 * @function
 */
export const createAbsolutePositionFromCursor = (cursor, y) => {
  const store = y.store
  const rightID = cursor.item
  const typeID = cursor.type
  const tname = cursor.tname
  let type = null
  let offset = 0
  if (rightID !== null) {
    if (getState(store, rightID.client) <= rightID.clock) {
      return null
    }
    const right = getItem(store, rightID)
    if (!(right instanceof AbstractItem)) {
      return null
    }
    offset = right.deleted || !right.countable ? 0 : rightID.clock - right.id.clock
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
      if (getState(store, typeID.client) <= typeID.clock) {
        // type does not exist yet
        return null
      }
      const struct = getItemType(store, typeID)
      if (struct instanceof ItemType) {
        type = struct.type
      } else {
        // struct is garbage collected
        return null
      }
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
 * @param {Cursor|null} a
 * @param {Cursor|null} b
 *
 * @function
 */
export const compareCursors = (a, b) => a === b || (
  a !== null && b !== null && a.tname === b.tname && compareIDs(a.item, b.item) && compareIDs(a.type, b.type)
)
