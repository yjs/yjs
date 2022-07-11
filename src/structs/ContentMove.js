
import * as error from 'lib0/error'
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import * as math from 'lib0/math'
import {
  writeID,
  readID,
  ID, AbstractType, ContentType, RelativePosition, UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, Transaction, Item, StructStore, getItem, getItemCleanStart, getItemCleanEnd, // eslint-disable-line
  addsStruct
} from '../internals.js'

/**
 * @param {ContentMove | { start: RelativePosition, end: RelativePosition }} moved
 * @param {Transaction} tr
 * @param {boolean} split
 * @return {{ start: Item, end: Item }} $start (inclusive) is the beginning and $end (inclusive) is the end of the moved area
 */
export const getMovedCoords = (moved, tr, split) => {
  const store = tr.doc.store
  const startItem = moved.start.item
  const endItem = moved.end.item
  let start // this (inclusive) is the beginning of the moved area
  let end // this (exclusive) is the first item after start that is not part of the moved area
  if (startItem) {
    if (moved.start.assoc < 0) {
      // We know that the items have already been split, hence getItem suffices.
      start = split ? getItemCleanEnd(tr, startItem) : getItem(store, startItem)
      start = start.right
    } else {
      start = split ? getItemCleanStart(tr, startItem) : getItem(store, startItem)
    }
  } else if (moved.start.tname != null) {
    start = tr.doc.get(moved.start.tname)._start
  } else if (moved.start.type) {
    start = /** @type {ContentType} */ (getItem(store, moved.start.type).content).type._start
  } else {
    error.unexpectedCase()
  }
  if (endItem) {
    if (moved.end.assoc < 0) {
      end = split ? getItemCleanEnd(tr, endItem) : getItem(store, endItem)
      end = end.right
    } else {
      end = split ? getItemCleanStart(tr, endItem) : getItem(store, endItem)
    }
  } else {
    error.unexpectedCase()
  }
  return { start: /** @type {Item} */ (start), end: /** @type {Item} */ (end) }
}

/**
 * @param {Transaction} tr
 * @param {ContentMove} moved
 * @param {Item} movedItem
 * @param {Set<Item>} trackedMovedItems
 * @return {boolean} true if there is a loop
 */
export const findMoveLoop = (tr, moved, movedItem, trackedMovedItems) => {
  if (trackedMovedItems.has(movedItem)) {
    return true
  }
  trackedMovedItems.add(movedItem)
  /**
   * @type {{ start: Item | null, end: Item | null }}
   */
  let { start, end } = getMovedCoords(moved, tr, false)
  while (start !== end && start != null) {
    if (
      !start.deleted &&
      start.moved === movedItem &&
      start.content.constructor === ContentMove &&
      findMoveLoop(tr, start.content, start, trackedMovedItems)
    ) {
      return true
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
    const sm = /** @type {AbstractType<any>} */ (item.parent)._searchMarker
    if (sm) sm.length = 0
    const movedCoords = getMovedCoords(this, transaction, true)
    /**
     * @type {{ start: Item | null, end: item | null }}
     */
    let { start, end } = movedCoords
    let maxPriority = 0
    // If this ContentMove was created locally, we set prio = -1. This indicates
    // that we want to set prio to the current prio-maximum of the moved range.
    const adaptPriority = this.priority < 0
    while (start !== end && start != null) {
      const prevMove = start.moved // this is the same as prevMove
      const nextPrio = prevMove ? /** @type {ContentMove} */ (prevMove.content).priority : -1
      if (adaptPriority || nextPrio < this.priority || (prevMove != null && nextPrio === this.priority && (prevMove.id.client < item.id.client || (prevMove.id.client === item.id.client && prevMove.id.clock < item.id.clock)))) {
        if (prevMove !== null) {
          if (/** @type {ContentMove} */ (prevMove.content).isCollapsed()) {
            prevMove.deleteAsCleanup(transaction, adaptPriority)
          }
          this.overrides.add(prevMove)
          if (start !== movedCoords.start) {
            // only add this to mergeStructs if this is not the first item
            transaction._mergeStructs.push(start)
          }
        }
        maxPriority = math.max(maxPriority, nextPrio)
        // was already moved
        if (prevMove && !transaction.prevMoved.has(start) && !addsStruct(transaction, prevMove)) {
          // only override prevMoved if the prevMoved item is not new
          // we need to know which item previously moved an item
          transaction.prevMoved.set(start, prevMove)
        }
        start.moved = item
        if (!start.deleted && start.content.constructor === ContentMove && findMoveLoop(transaction, start.content, start, new Set([item]))) {
          item.deleteAsCleanup(transaction, adaptPriority)
          return
        }
      } else if (prevMove != null) {
        /** @type {ContentMove} */ (prevMove.content).overrides.add(item)
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
    let { start, end } = getMovedCoords(this, transaction, false)
    while (start !== end && start != null) {
      if (start.moved === item) {
        const prevMoved = transaction.prevMoved.get(start)
        if (addsStruct(transaction, item)) {
          if (prevMoved === item) {
            // Edge case: Item has been moved by this move op and it has been created & deleted in the same transaction (hence no effect that should be emitted by the change computation)
            transaction.prevMoved.delete(start)
          }
        } else if (prevMoved == null) { // && !addsStruct(tr, item)
          // Normal case: item has been moved by this move and it has not been created & deleted in the same transaction
          transaction.prevMoved.set(start, item)
        }
        start.moved = null
      }
      start = start.right
    }
    /**
     * @param {Item} reIntegrateItem
     */
    const reIntegrate = reIntegrateItem => {
      const content = /** @type {ContentMove} */ (reIntegrateItem.content)
      // content is not yet transformed to a ContentDeleted
      if (content.getRef() === 11) {
        if (reIntegrateItem.deleted) {
          // potentially we can integrate the items that reIntegrateItem overrides
          content.overrides.forEach(reIntegrate)
        } else {
          content.integrate(transaction, reIntegrateItem)
        }
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
    encoding.writeVarUint(encoder.restEncoder, (isCollapsed ? 1 : 0) | (this.start.assoc >= 0 ? 2 : 0) | (this.end.assoc >= 0 ? 4 : 0) | this.priority << 3)
    writeID(encoder.restEncoder, /** @type {ID} */ (this.start.item))
    if (!isCollapsed) {
      writeID(encoder.restEncoder, /** @type {ID} */ (this.end.item))
    }
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
 *
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
 * @return {ContentMove}
 */
export const readContentMove = decoder => {
  const info = decoding.readVarUint(decoder.restDecoder)
  const isCollapsed = (info & 1) === 1
  const startAssoc = (info & 2) === 2 ? 0 : -1
  const endAssoc = (info & 4) === 4 ? 0 : -1
  const priority = info >>> 3
  const startId = readID(decoder.restDecoder)
  const start = new RelativePosition(null, null, startId, startAssoc)
  const end = new RelativePosition(null, null, isCollapsed ? startId : readID(decoder.restDecoder), endAssoc)
  return new ContentMove(start, end, priority)
}
