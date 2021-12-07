
import * as error from 'lib0/error'
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import * as math from 'lib0/math'
import {
  AbstractType, ContentType, RelativePosition, UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, Transaction, Item, StructStore, getItem, getItemCleanStart, getItemCleanEnd // eslint-disable-line
} from '../internals.js'
import { decodeRelativePosition, encodeRelativePosition } from 'yjs'

/**
 * @param {ContentMove} moved
 * @param {Transaction} tr
 * @return {{ start: Item, end: Item | null }} $start (inclusive) is the beginning and $end (exclusive) is the end of the moved area
 */
export const getMovedCoords = (moved, tr) => {
  let start // this (inclusive) is the beginning of the moved area
  let end // this (exclusive) is the first item after start that is not part of the moved area
  if (moved.start.item) {
    if (moved.start.assoc < 0) {
      start = getItemCleanEnd(tr, moved.start.item)
      start = start.right
    } else {
      start = getItemCleanStart(tr, moved.start.item)
    }
  } else if (moved.start.tname != null) {
    start = tr.doc.get(moved.start.tname)._start
  } else if (moved.start.type) {
    start = /** @type {ContentType} */ (getItem(tr.doc.store, moved.start.type).content).type._start
  } else {
    error.unexpectedCase()
  }
  if (moved.end.item) {
    if (moved.end.assoc < 0) {
      end = getItemCleanEnd(tr, moved.end.item)
      end = end.right
    } else {
      end = getItemCleanStart(tr, moved.end.item)
    }
  } else {
    end = null
  }
  return { start: /** @type {Item} */ (start), end }
}

/**
 * @todo remove this if not needed
 *
 * @param {ContentMove} moved
 * @param {Item} movedItem
 * @param {Transaction} tr
 * @param {function(Item):void} cb
 */
export const iterateMoved = (moved, movedItem, tr, cb) => {
  /**
   * @type {{ start: Item | null, end: Item | null }}
   */
  let { start, end } = getMovedCoords(moved, tr)
  while (start !== end && start != null) {
    if (!start.deleted) {
      if (start.moved === movedItem) {
        if (start.content.constructor === ContentMove) {
          iterateMoved(start.content, start, tr, cb)
        } else {
          cb(start)
        }
      }
    }
    start = start.right
  }
}

/**
 * @param {ContentMove} moved
 * @param {Item} movedItem
 * @param {Set<Item>} trackedMovedItems
 * @param {Transaction} tr
 * @return {boolean} true if there is a loop
 */
export const findMoveLoop = (moved, movedItem, trackedMovedItems, tr) => {
  if (trackedMovedItems.has(movedItem)) {
    return true
  }
  trackedMovedItems.add(movedItem)
  /**
   * @type {{ start: Item | null, end: Item | null }}
   */
  let { start, end } = getMovedCoords(moved, tr)
  while (start !== end && start != null) {
    if (start.deleted && start.moved === movedItem && start.content.constructor === ContentMove) {
      if (findMoveLoop(start.content, start, trackedMovedItems, tr)) {
        return true
      }
    }
    start = start.right
  }
  return false
}

/**
 * @private
 */
export class ContentMove {
  /**
   * @param {RelativePosition} start
   * @param {RelativePosition} end
   * @param {number} priority if we want to move content that is already moved, we need to assign a higher priority to this move operation.
   */
  constructor (start, end, priority) {
    this.start = start
    this.end = end
    this.priority = priority
    /**
     * We store which Items+ContentMove we override. Once we delete
     * this ContentMove, we need to re-integrate the overridden items.
     *
     * This representation can be improved if we ever run into memory issues because of too many overrides.
     * Ideally, we should probably just re-iterate the document and re-integrate all moved items.
     * This is fast enough and reduces memory footprint significantly.
     *
     * @type {Set<Item>}
     */
    this.overrides = new Set()
  }

  /**
   * @return {number}
   */
  getLength () {
    return 1
  }

  /**
   * @return {Array<any>}
   */
  getContent () {
    return [null]
  }

  /**
   * @return {boolean}
   */
  isCountable () {
    return false
  }

  /**
   * @return {ContentMove}
   */
  copy () {
    return new ContentMove(this.start, this.end, this.priority)
  }

  /**
   * @param {number} offset
   * @return {ContentMove}
   */
  splice (offset) {
    return this
  }

  /**
   * @param {ContentMove} right
   * @return {boolean}
   */
  mergeWith (right) {
    return false
  }

  /**
   * @param {Transaction} transaction
   * @param {Item} item
   */
  integrate (transaction, item) {
    /** @type {AbstractType<any>} */ (item.parent)._searchMarker = []
    /**
     * @type {{ start: Item | null, end: Item | null }}
     */
    let { start, end } = getMovedCoords(this, transaction)
    let maxPriority = 0
    // If this ContentMove was created locally, we set prio = -1. This indicates
    // that we want to set prio to the current prio-maximum of the moved range.
    const adaptPriority = this.priority < 0
    while (start !== end && start != null) {
      if (!start.deleted) {
        const currMoved = start.moved
        const nextPrio = currMoved ? /** @type {ContentMove} */ (currMoved.content).priority : -1
        if (currMoved === null || adaptPriority || nextPrio < this.priority || currMoved.id.client < item.id.client || (currMoved.id.client === item.id.client && currMoved.id.clock < item.id.clock)) {
          if (currMoved !== null) {
            this.overrides.add(currMoved)
          }
          maxPriority = math.max(maxPriority, nextPrio)
          // was already moved
          if (start.moved && !transaction.prevMoved.has(start)) {
            // we need to know which item previously moved an item
            transaction.prevMoved.set(start, start.moved)
          }
          start.moved = item
        } else {
          /** @type {ContentMove} */ (currMoved.content).overrides.add(item)
        }
      }
      start = start.right
    }
    if (adaptPriority) {
      this.priority = maxPriority + 1
    }
  }

  /**
   * @param {Transaction} transaction
   * @param {Item} item
   */
  delete (transaction, item) {
    /**
     * @type {{ start: Item | null, end: Item | null }}
     */
    let { start, end } = getMovedCoords(this, transaction)
    while (start !== end && start != null) {
      if (start.moved === item) {
        start.moved = null
      }
      start = start.right
    }
    /**
     * @param {Item} reIntegrateItem
     */
    const reIntegrate = reIntegrateItem => {
      const content = /** @type {ContentMove} */ (reIntegrateItem.content)
      if (reIntegrateItem.deleted) {
        // potentially we can integrate the items that reIntegrateItem overrides
        content.overrides.forEach(reIntegrate)
      } else {
        content.integrate(transaction, reIntegrateItem)
      }
    }
    this.overrides.forEach(reIntegrate)
  }

  /**
   * @param {StructStore} store
   */
  gc (store) {}

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    const isCollapsed = this.isCollapsed()
    encoding.writeUint8(encoder.restEncoder, isCollapsed ? 1 : 0)
    encoder.writeBuf(encodeRelativePosition(this.start))
    if (!isCollapsed) {
      encoder.writeBuf(encodeRelativePosition(this.end))
    }
    encoding.writeVarUint(encoder.restEncoder, this.priority)
  }

  /**
   * @return {number}
   */
  getRef () {
    return 11
  }

  isCollapsed () {
    return this.start.item === this.end.item && this.start.item !== null
  }
}

/**
 * @private
 * @todo use binary encoding option for start & end relpos's
 *
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
 * @return {ContentMove}
 */
export const readContentMove = decoder => {
  const isCollapsed = decoding.readUint8(decoder.restDecoder) === 1
  const start = decodeRelativePosition(decoder.readBuf())
  const end = isCollapsed ? start.clone() : decodeRelativePosition(decoder.readBuf())
  if (isCollapsed) {
    end.assoc = -1
  }
  return new ContentMove(start, end, decoding.readVarUint(decoder.restDecoder))
}
