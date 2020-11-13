
import {
  writeID,
  readID,
  compareIDs,
  getState,
  findRootTypeKey,
  Item,
  createID,
  ContentType,
  followRedone,
  ID, Doc, AbstractType // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import * as error from 'lib0/error.js'

/**
 * A relative position is based on the Yjs model and is not affected by document changes.
 * E.g. If you place a relative position before a certain character, it will always point to this character.
 * If you place a relative position at the end of a type, it will always point to the end of the type.
 *
 * A numeric position is often unsuited for user selections, because it does not change when content is inserted
 * before or after.
 *
 * ```Insert(0, 'x')('a|bc') = 'xa|bc'``` Where | is the relative position.
 *
 * One of the properties must be defined.
 *
 * @example
 *   // Current cursor position is at position 10
 *   const relativePosition = createRelativePositionFromIndex(yText, 10)
 *   // modify yText
 *   yText.insert(0, 'abc')
 *   yText.delete(3, 10)
 *   // Compute the cursor position
 *   const absolutePosition = createAbsolutePositionFromRelativePosition(y, relativePosition)
 *   absolutePosition.type === yText // => true
 *   console.log('cursor location is ' + absolutePosition.index) // => cursor location is 3
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

/**
 * @param {any} json
 * @return {RelativePosition}
 *
 * @function
 */
export const createRelativePositionFromJSON = json => new RelativePosition(json.type == null ? null : createID(json.type.client, json.type.clock), json.tname || null, json.item == null ? null : createID(json.item.client, json.item.clock))

export class AbsolutePosition {
  /**
   * @param {AbstractType<any>} type
   * @param {number} index
   */
  constructor (type, index) {
    /**
     * @type {AbstractType<any>}
     */
    this.type = type
    /**
     * @type {number}
     */
    this.index = index
  }
}

/**
 * @param {AbstractType<any>} type
 * @param {number} index
 *
 * @function
 */
export const createAbsolutePosition = (type, index) => new AbsolutePosition(type, index)

/**
 * @param {AbstractType<any>} type
 * @param {ID|null} item
 *
 * @function
 */
export const createRelativePosition = (type, item) => {
  let typeid = null
  let tname = null
  if (type._item === null) {
    tname = findRootTypeKey(type)
  } else {
    typeid = createID(type._item.id.client, type._item.id.clock)
  }
  return new RelativePosition(typeid, tname, item)
}

/**
 * Create a relativePosition based on a absolute position.
 *
 * @param {AbstractType<any>} type The base type (e.g. YText or YArray).
 * @param {number} index The absolute position.
 * @return {RelativePosition}
 *
 * @function
 */
export const createRelativePositionFromTypeIndex = (type, index) => {
  let t = type._start
  while (t !== null) {
    if (!t.deleted && t.countable) {
      if (t.length > index) {
        // case 1: found position somewhere in the linked list
        return createRelativePosition(type, createID(t.id.client, t.id.clock + index))
      }
      index -= t.length
    }
    t = t.right
  }
  return createRelativePosition(type, null)
}

/**
 * @param {encoding.Encoder} encoder
 * @param {RelativePosition} rpos
 *
 * @function
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
 * @param {RelativePosition} rpos
 * @return {Uint8Array}
 */
export const encodeRelativePosition = rpos => {
  const encoder = encoding.createEncoder()
  writeRelativePosition(encoder, rpos)
  return encoding.toUint8Array(encoder)
}

/**
 * @param {decoding.Decoder} decoder
 * @return {RelativePosition|null}
 *
 * @function
 */
export const readRelativePosition = decoder => {
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
 * @param {Uint8Array} uint8Array
 * @return {RelativePosition|null}
 */
export const decodeRelativePosition = uint8Array => readRelativePosition(decoding.createDecoder(uint8Array))

/**
 * @param {RelativePosition} rpos
 * @param {Doc} doc
 * @return {AbsolutePosition|null}
 *
 * @function
 */
export const createAbsolutePositionFromRelativePosition = (rpos, doc) => {
  const store = doc.store
  const rightID = rpos.item
  const typeID = rpos.type
  const tname = rpos.tname
  let type = null
  let index = 0
  if (rightID !== null) {
    if (getState(store, rightID.client) <= rightID.clock) {
      return null
    }
    const res = followRedone(store, rightID)
    const right = res.item
    if (!(right instanceof Item)) {
      return null
    }
    type = /** @type {AbstractType<any>} */ (right.parent)
    if (type._item === null || !type._item.deleted) {
      index = right.deleted || !right.countable ? 0 : res.diff
      let n = right.left
      while (n !== null) {
        if (!n.deleted && n.countable) {
          index += n.length
        }
        n = n.left
      }
    }
  } else {
    if (tname !== null) {
      type = doc.get(tname)
    } else if (typeID !== null) {
      if (getState(store, typeID.client) <= typeID.clock) {
        // type does not exist yet
        return null
      }
      const { item } = followRedone(store, typeID)
      if (item instanceof Item && item.content instanceof ContentType) {
        type = item.content.type
      } else {
        // struct is garbage collected
        return null
      }
    } else {
      throw error.unexpectedCase()
    }
    index = type._length
  }
  return createAbsolutePosition(type, index)
}

/**
 * @param {RelativePosition|null} a
 * @param {RelativePosition|null} b
 * @return {boolean}
 *
 * @function
 */
export const compareRelativePositions = (a, b) => a === b || (
  a !== null && b !== null && a.tname === b.tname && compareIDs(a.item, b.item) && compareIDs(a.type, b.type)
)
