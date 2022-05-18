import * as error from 'lib0/error'

import {
  getItemCleanStart,
  createID,
  getMovedCoords,
  updateMarkerChanges,
  getState,
  ContentAny,
  ContentBinary,
  ContentType,
  ContentDoc,
  Doc,
  compareIDs,
  createRelativePosition,
  RelativePosition, ID, AbstractContent, ContentMove, Transaction, Item, AbstractType // eslint-disable-line
} from '../internals.js'
import { compareRelativePositions } from './RelativePosition.js'

const lengthExceeded = error.create('Length exceeded!')

/**
 * We keep the moved-stack across several transactions. Local or remote changes can invalidate
 * "moved coords" on the moved-stack.
 *
 * The reason for this is that if assoc < 0, then getMovedCoords will return the target.right item.
 * While the computed item is on the stack, it is possible that a user inserts something between target
 * and the item on the stack. Then we expect that the newly inserted item is supposed to be on the new
 * computed item.
 *
 * @param {Transaction} tr
 * @param {ListIterator} li
 */
const popMovedStack = (tr, li) => {
  let { start, end, move } = li.movedStack.pop() || { start: null, end: null, move: null }
  if (move) {
    const moveContent = /** @type {ContentMove} */ (move.content)
    if (
      (
        moveContent.start.assoc < 0 && (
          (start === null && moveContent.start.item !== null) ||
          (start !== null && !compareIDs(/** @type {Item} */ (start.left).lastId, moveContent.start.item))
        )
      ) || (
        moveContent.end.assoc < 0 && (
          (end === null && moveContent.end.item !== null) ||
          (end !== null && !compareIDs(/** @type {Item} */ (end.left).lastId, moveContent.end.item))
        )
      )
    ) {
      const coords = getMovedCoords(moveContent, tr)
      start = coords.start
      end = coords.end
    }
  }
  li.currMove = move
  li.currMoveStart = start
  li.currMoveEnd = end
  li.reachedEnd = false
}

/**
 * @todo rename to walker?
 * @todo check that inserting character one after another always reuses ListIterators
 */
export class ListIterator {
  /**
   * @param {AbstractType<any>} type
   */
  constructor (type) {
    this.type = type
    /**
     * Current index-position
     */
    this.index = 0
    /**
     * Relative position to the current item (if item.content.length > 1)
     */
    this.rel = 0
    /**
     * This refers to the current right item, unless reachedEnd is true. Then it refers to the left item.
     *
     * @public
     * @type {Item | null}
     */
    this.nextItem = type._start
    this.reachedEnd = type._start === null
    /**
     * @type {Item | null}
     */
    this.currMove = null
    /**
     * @type {Item | null}
     */
    this.currMoveStart = null
    /**
     * @type {Item | null}
     */
    this.currMoveEnd = null
    /**
     * @type {Array<{ start: Item | null, end: Item | null, move: Item }>}
     */
    this.movedStack = []
  }

  clone () {
    const iter = new ListIterator(this.type)
    iter.index = this.index
    iter.rel = this.rel
    iter.nextItem = this.nextItem
    iter.reachedEnd = this.reachedEnd
    iter.currMove = this.currMove
    iter.currMoveStart = this.currMoveStart
    iter.currMoveEnd = this.currMoveEnd
    iter.movedStack = this.movedStack.slice()
    return iter
  }

  /**
   * @type {Item | null}
   */
  get left () {
    if (this.reachedEnd) {
      return this.nextItem
    } else {
      return this.nextItem && this.nextItem.left
    }
  }

  /**
   * @type {Item | null}
   */
  get right () {
    if (this.reachedEnd) {
      return null
    } else {
      return this.nextItem
    }
  }

  /**
   * @param {Transaction} tr
   * @param {number} index
   */
  moveTo (tr, index) {
    const diff = index - this.index
    if (diff > 0) {
      this.forward(tr, diff, true)
    } else if (diff < 0) {
      this.backward(tr, -diff)
    }
  }

  /**
   * When using skipUncountables=false within a "useSearchMarker" call, it is recommended
   * to move the marker to the end. @todo do this after each useSearchMarkerCall
   *
   * @param {Transaction} tr
   * @param {number} len
   * @param {boolean} skipUncountables Iterate as much as possible iterating over uncountables until we find the next item.
   */
  forward (tr, len, skipUncountables) {
    if (len === 0 && this.nextItem == null) {
      return this
    }
    if (this.index + len > this.type._length || this.nextItem == null) {
      throw lengthExceeded
    }
    let item = /** @type {Item} */ (this.nextItem)
    this.index += len
    // @todo this condition is not needed, better to remove it (can always be applied)
    if (this.rel) {
      len += this.rel
      this.rel = 0
    }
    // eslint-disable-next-line no-unmodified-loop-condition
    while ((!this.reachedEnd || this.currMove !== null) && (len > 0 || (skipUncountables && len === 0 && item && (!item.countable || item.deleted || item === this.currMoveEnd || (this.reachedEnd && this.currMoveEnd === null) || item.moved !== this.currMove)))) {
      if (item === this.currMoveEnd || (this.currMoveEnd === null && this.reachedEnd && this.currMove)) {
        item = /** @type {Item} */ (this.currMove) // we iterate to the right after the current condition
        popMovedStack(tr, this)
      } else if (item === null) {
        error.unexpectedCase() // should never happen
      } else if (item.countable && !item.deleted && item.moved === this.currMove && len > 0) {
        len -= item.length
        if (len < 0) {
          this.rel = item.length + len
          len = 0
          break
        }
      } else if (item.content.constructor === ContentMove && item.moved === this.currMove) {
        if (this.currMove) {
          this.movedStack.push({ start: this.currMoveStart, end: this.currMoveEnd, move: this.currMove })
        }
        const { start, end } = getMovedCoords(item.content, tr)
        this.currMove = item
        this.currMoveStart = start
        this.currMoveEnd = end
        item = start
        continue
      }
      if (this.reachedEnd) {
        throw error.unexpectedCase
      }
      if (item.right) {
        item = item.right
      } else {
        this.reachedEnd = true // @todo we need to ensure to iterate further if this.currMoveEnd === null
      }
    }
    this.index -= len
    this.nextItem = item
    return this
  }

  /**
   * We prefer to insert content outside of a moved range.
   * Try to escape the moved range by walking to the left over deleted items.
   *
   * @param {Transaction} tr
   */
  reduceMoveDepth (tr) {
    let nextItem = this.nextItem
    if (nextItem !== null) {
      while (this.currMove) {
        if (nextItem === this.currMoveStart) {
          nextItem = /** @type {Item} */ (this.currMove) // we iterate to the left after the current condition
          popMovedStack(tr, this)
          continue
        }
        // check if we can iterate to the left while stepping over deleted items until we find an item === this.currMoveStart
        /**
         * @type {Item} nextItem
         */
        let item = nextItem
        while (item.deleted && item.moved === this.currMove && item !== this.currMoveStart) {
          item = /** @type {Item} */ (item.left) // this must exist otherwise we miscalculated the move
        }
        if (item === this.currMoveStart) {
          // we only want to iterate over deleted items if we can escape a move
          nextItem = item
        } else {
          break
        }
      }
      this.nextItem = nextItem
    }
  }

  /**
   * @param {Transaction} tr
   * @param {number} len
   * @return {ListIterator}
   */
  backward (tr, len) {
    if (this.index - len < 0) {
      throw lengthExceeded
    }
    this.index -= len
    if (this.reachedEnd) {
      const nextItem = /** @type {Item} */ (this.nextItem)
      this.rel = nextItem.countable && !nextItem.deleted ? nextItem.length : 0
      this.reachedEnd = false
    }
    if (this.rel >= len) {
      this.rel -= len
      return this
    }
    let item = this.nextItem
    if (item && item.content.constructor === ContentMove) {
      item = item.left
    } else {
      len += ((item && item.countable && !item.deleted && item.moved === this.currMove) ? item.length : 0) - this.rel
    }
    this.rel = 0
    while (item && len > 0) {
      if (item.countable && !item.deleted && item.moved === this.currMove) {
        len -= item.length
        if (len < 0) {
          this.rel = -len
          len = 0
        }
        if (len === 0) {
          break
        }
      } else if (item.content.constructor === ContentMove && item.moved === this.currMove) {
        if (this.currMove) {
          this.movedStack.push({ start: this.currMoveStart, end: this.currMoveEnd, move: this.currMove })
        }
        const { start, end } = getMovedCoords(item.content, tr)
        this.currMove = item
        this.currMoveStart = start
        this.currMoveEnd = end
        item = start
        continue
      }
      if (item === this.currMoveStart) {
        item = /** @type {Item} */ (this.currMove) // we iterate to the left after the current condition
        popMovedStack(tr, this)
      }
      item = item.left
    }
    this.nextItem = item
    return this
  }

  /**
   * @template {{length: number}} T
   * @param {Transaction} tr
   * @param {number} len
   * @param {T} value the initial content
   * @param {function(AbstractContent, number, number):T} slice
   * @param {function(T, T): T} concat
   */
  _slice (tr, len, value, slice, concat) {
    if (this.index + len > this.type._length) {
      throw lengthExceeded
    }
    this.index += len
    /**
     * We store nextItem in a variable because this version cannot be null.
     */
    let nextItem = /** @type {Item} */ (this.nextItem)
    while (len > 0 && !this.reachedEnd) {
      while (nextItem.countable && !this.reachedEnd && len > 0 && nextItem !== this.currMoveEnd) {
        if (!nextItem.deleted && nextItem.moved === this.currMove) {
          const slicedContent = slice(nextItem.content, this.rel, len)
          len -= slicedContent.length
          value = concat(value, slicedContent)
          if (this.rel + slicedContent.length === nextItem.length) {
            this.rel = 0
          } else {
            this.rel += slicedContent.length
            continue // do not iterate to item.right
          }
        }
        if (nextItem.right) {
          nextItem = nextItem.right
          this.nextItem = nextItem // @todo move this after the while loop
        } else {
          this.reachedEnd = true
        }
      }
      if ((!this.reachedEnd || this.currMove !== null) && len > 0) {
        // always set nextItem before any method call
        this.nextItem = nextItem
        this.forward(tr, 0, true)
        if (this.nextItem == null) {
          throw new Error('debug me') // @todo remove
        }
        nextItem = this.nextItem
      }
    }
    this.nextItem = nextItem
    if (len < 0) {
      this.index -= len
    }
    return value
  }

  /**
   * @param {Transaction} tr
   * @param {number} len
   */
  delete (tr, len) {
    const startLength = len
    const sm = this.type._searchMarker
    let item = this.nextItem
    if (this.index + len > this.type._length) {
      throw lengthExceeded
    }
    while (len > 0) {
      while (item && !item.deleted && item.countable && !this.reachedEnd && len > 0 && item.moved === this.currMove && item !== this.currMoveEnd) {
        if (this.rel > 0) {
          item = getItemCleanStart(tr, createID(item.id.client, item.id.clock + this.rel))
          this.rel = 0
        }
        if (len < item.length) {
          getItemCleanStart(tr, createID(item.id.client, item.id.clock + len))
        }
        len -= item.length
        item.delete(tr)
        if (item.right) {
          item = item.right
        } else {
          this.reachedEnd = true
        }
      }
      if (len > 0) {
        this.nextItem = item
        this.forward(tr, 0, true)
        item = this.nextItem
      }
    }
    this.nextItem = item
    if (sm) {
      updateMarkerChanges(sm, this.index, -startLength + len, this)
    }
  }

  /**
   * @param {Transaction} tr
   */
  _splitRel (tr) {
    if (this.rel > 0) {
      /**
       * @type {ID}
       */
      const itemid = /** @type {Item} */ (this.nextItem).id
      this.nextItem = getItemCleanStart(tr, createID(itemid.client, itemid.clock + this.rel))
      this.rel = 0
    }
  }

  /**
   * Important: you must update markers after calling this method!
   *
   * @param {Transaction} tr
   * @param {Array<AbstractContent>} content
   */
  insertContents (tr, content) {
    this.reduceMoveDepth(tr)
    this._splitRel(tr)
    const parent = this.type
    const store = tr.doc.store
    const ownClientId = tr.doc.clientID
    /**
     * @type {Item | null}
     */
    const right = this.right

    /**
     * @type {Item | null}
     */
    let left = this.left
    content.forEach(c => {
      left = new Item(createID(ownClientId, getState(store, ownClientId)), left, left && left.lastId, right, right && right.id, parent, null, c)
      left.integrate(tr, 0)
    })
    if (right === null) {
      this.nextItem = left
      this.reachedEnd = true
    } else {
      this.nextItem = right
    }
  }

  /**
   * @param {Transaction} tr
   * @param {Array<{ start: RelativePosition, end: RelativePosition }>} ranges
   */
  insertMove (tr, ranges) {
    this.insertContents(tr, ranges.map(range => new ContentMove(range.start, range.end, -1)))
    // @todo is there a better alrogirthm to update searchmarkers? We could simply remove the markers that are in the updated range.
    // Also note that searchmarkers are updated in insertContents as well.
    const sm = this.type._searchMarker
    if (sm) sm.length = 0 // @todo instead, iterate through sm and delete all marked properties on items
  }

  /**
   * @param {Transaction} tr
   * @param {Array<Object<string,any>|Array<any>|boolean|number|null|string|Uint8Array>} values
   */
  insertArrayValue (tr, values) {
    this._splitRel(tr)
    const sm = this.type._searchMarker
    /**
     * @type {Array<AbstractContent>}
     */
    const contents = []
    /**
     * @type {Array<Object|Array<any>|number|null>}
     */
    let jsonContent = []
    const packJsonContent = () => {
      if (jsonContent.length > 0) {
        contents.push(new ContentAny(jsonContent))
        jsonContent = []
      }
    }
    values.forEach(c => {
      if (c === null) {
        jsonContent.push(c)
      } else {
        switch (c.constructor) {
          case Number:
          case Object:
          case Boolean:
          case Array:
          case String:
            jsonContent.push(c)
            break
          default:
            packJsonContent()
            switch (c.constructor) {
              case Uint8Array:
              case ArrayBuffer:
                contents.push(new ContentBinary(new Uint8Array(/** @type {Uint8Array} */ (c))))
                break
              case Doc:
                contents.push(new ContentDoc(/** @type {Doc} */ (c)))
                break
              default:
                if (c instanceof AbstractType) {
                  contents.push(new ContentType(c))
                } else {
                  throw new Error('Unexpected content type in insert operation')
                }
            }
        }
      }
    })
    packJsonContent()
    this.insertContents(tr, contents)
    this.index += values.length
    if (sm) {
      updateMarkerChanges(sm, this.index - values.length, values.length, this)
    }
  }

  /**
   * @param {Transaction} tr
   * @param {number} len
   */
  slice (tr, len) {
    return this._slice(tr, len, [], sliceArrayContent, concatArrayContent)
  }

  /**
   * @param {Transaction} tr
   * @param {function(any, number, any):void} f
   */
  forEach (tr, f) {
    for (const val of this.values(tr)) {
      f(val, this.index, this.type)
    }
  }

  /**
   * @template T
   * @param {Transaction} tr
   * @param {function(any, number, any):T} f
   * @return {Array<T>}
   */
  map (tr, f) {
    const arr = new Array(this.type._length - this.index)
    let i = 0
    for (const val of this.values(tr)) {
      arr[i++] = f(val, this.index, this.type)
    }
    return arr
  }

  /**
   * @param {Transaction} tr
   */
  values (tr) {
    return {
      [Symbol.iterator] () {
        return this
      },
      next: () => {
        if (this.reachedEnd || this.index === this.type._length) {
          return { done: true }
        }
        const [value] = this.slice(tr, 1)
        return {
          done: false,
          value: value
        }
      }
    }
  }
}

/**
 * @param {AbstractContent} itemcontent
 * @param {number} start
 * @param {number} len
 */
const sliceArrayContent = (itemcontent, start, len) => {
  const content = itemcontent.getContent()
  return content.length <= len && start === 0 ? content : content.slice(start, start + len)
}
/**
 * @param {Array<any>} content
 * @param {Array<any>} added
 */
const concatArrayContent = (content, added) => {
  content.push(...added)
  return content
}

/**
 * Move-ranges must not cross each other.
 *
 * This function computes the minimal amount of ranges to move a range of content to
 * a different place.
 *
 * Algorithm:
 * * Store the current stack in $preStack and $preItem = walker.nextItem
 * * Iterate forward $len items.
 * * The current stack is stored is $afterStack and $
 * * Delete the stack-items that both of them have in common
 *
 * @param {Transaction} tr
 * @param {ListIterator} walker
 * @param {number} len
 * @return {Array<{ start: RelativePosition, end: RelativePosition }>}
 */
export const getMinimalListViewRanges = (tr, walker, len) => {
  if (len === 0) return []
  if (walker.index + len > walker.type._length) {
    throw lengthExceeded
  }
  // stepping outside the current move-range as much as possible
  walker.reduceMoveDepth(tr)

  /**
   * @type {Array<{ start: RelativePosition, end: RelativePosition }>}
   */
  const ranges = []
  // store relevant information for the beginning, before we iterate forward
  /**
   * @type {Array<Item>}
   */
  const preStack = walker.movedStack.map(si => si.move)
  const preMove = walker.currMove
  const preItem = /** @type {Item} */ (walker.nextItem)
  const preRel = walker.rel

  walker.forward(tr, len, false)

  // store the same information for the end, after we iterate forward
  /**
   * @type {Array<Item>}
   */
  const afterStack = walker.movedStack.map(si => si.move)
  const afterMove = walker.currMove
  /**
  const nextIsCurrMoveStart = walker.nextItem === walker.currMoveStart
    const afterItem = /** @type {Item} / (nextIsCurrMoveStart
    ? walker.currMove
    : (walker.rel > 0 || walker.reachedEnd)
        ? walker.nextItem
        : /** @type {Item} / (walker.nextItem).left
  ) */
  const afterItem = /** @type {Item} */ (
    (walker.rel > 0 || walker.reachedEnd)
      ? walker.nextItem
      : /** @type {Item} */ (walker.nextItem).left
  )
  /**
   * afterRel is always > 0
   */
  const afterRel = walker.rel > 0
    ? walker.rel
    : afterItem.length

  walker.forward(tr, 0, false) // @todo remove once this is done is useSearchMarker

  let start = createRelativePosition(walker.type, createID(preItem.id.client, preItem.id.clock + preRel), 0)
  let end = createRelativePosition(
    walker.type,
    createID(afterItem.id.client, afterItem.id.clock + afterRel - 1),
    -1
  )

  if (preMove) {
    preStack.push(preMove)
  }
  if (afterMove) {
    afterStack.push(afterMove)
  }

  // remove common stack-items
  while (preStack.length > 0 && preStack[0] === afterStack[0]) {
    preStack.shift()
    afterStack.shift()
  }

  // remove stack-items that are useless for our computation (that wouldn't produce meaningful ranges)
  // @todo

  while (preStack.length > 0) {
    const move = /** @type {Item} */ (preStack.pop())
    ranges.push({
      start,
      end: /** @type {ContentMove} */ (move.content).end
    })
    start = createRelativePosition(walker.type, createID(move.id.client, move.id.clock), -1)
  }

  const middleMove = { start, end }
  ranges.push(middleMove)

  while (afterStack.length > 0) {
    const move = /** @type {Item} */ (afterStack.pop())
    ranges.push({
      start: /** @type {ContentMove} */ (move.content).start,
      end
    })
    end = createRelativePosition(walker.type, createID(move.id.client, move.id.clock), 0)
  }

  // Update end of the center move operation
  // Move ranges must be applied in order
  middleMove.end = end

  // filter out unnecessary ranges
  return ranges.filter(range => !compareRelativePositions(range.start, range.end))
}
