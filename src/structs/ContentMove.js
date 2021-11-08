
import * as error from 'lib0/error'
import * as decoding from 'lib0/decoding'
import {
  AbstractType, ContentType, ID, RelativePosition, UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, Transaction, Item, StructStore, getItem, getItemCleanStart, getItemCleanEnd // eslint-disable-line
} from '../internals.js'

/**
 * @param {ContentMove} moved
 * @param {Transaction} tr
 * @return {{ start: Item | null, end: Item | null }} $start (inclusive) is the beginning and $end (exclusive) is the end of the moved area
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
  return { start, end }
}

/**
 * @param {ContentMove} moved
 * @param {Item} movedItem
 * @param {Transaction} tr
 * @param {function(Item):void} cb
 */
export const iterateMoved = (moved, movedItem, tr, cb) => {
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
    let { start, end } = getMovedCoords(this, transaction)
    while (start !== end && start != null) {
      if (!start.deleted) {
        const currMoved = start.moved
        if (currMoved === null || /** @type {ContentMove} */ (currMoved.content).priority < this.priority || currMoved.id.client < item.id.client || (currMoved.id.client === item.id.client && currMoved.id.clock < item.id.clock)) {
          if (currMoved !== null) {
            this.overrides.add(currMoved)
          }
          start.moved = item
        } else {
          /** @type {ContentMove} */ (currMoved.content).overrides.add(item)
        }
      }
      start = start.right
    }
  }

  /**
   * @param {Transaction} transaction
   * @param {Item} item
   */
  delete (transaction, item) {
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
    encoder.writeAny(this.start)
    encoder.writeAny(this.end)
  }

  /**
   * @return {number}
   */
  getRef () {
    return 11
  }
}

/**
 * @private
 *
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
 * @return {ContentMove}
 */
export const readContentMove = decoder => new ContentMove(decoder.readAny(), decoder.readAny(), decoding.readVarUint(decoder.restDecoder))
