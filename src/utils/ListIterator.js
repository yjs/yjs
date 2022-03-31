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
  RelativePosition, ID, AbstractContent, ContentMove, Transaction, Item, AbstractType // eslint-disable-line
} from '../internals.js'

const lengthExceeded = error.create('Length exceeded!')

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
      this.forward(tr, diff)
    } else if (diff < 0) {
      this.backward(tr, -diff)
    }
  }

  /**
   * @param {Transaction} tr
   * @param {number} len
   */
  forward (tr, len) {
    if (this.index + len > this.type._length) {
      throw lengthExceeded
    }
    let item = this.nextItem
    this.index += len
    // @todo this condition is not needed, better to remove it (can always be applied)
    if (this.rel) {
      len += this.rel
      this.rel = 0
    }
    while ((!this.reachedEnd || this.currMove !== null) && (len > 0 || (len === 0 && item && (!item.countable || item.deleted || item === this.currMoveEnd || (this.reachedEnd && this.currMoveEnd === null) || item.moved !== this.currMove)))) {
      if (item === this.currMoveEnd || (this.currMoveEnd === null && this.reachedEnd && this.currMove)) {
        item = /** @type {Item} */ (this.currMove) // we iterate to the right after the current condition
        const { start, end, move } = this.movedStack.pop() || { start: null, end: null, move: null }
        this.currMove = move
        this.currMoveStart = start
        this.currMoveEnd = end
        this.reachedEnd = false
      } else if (item === null) {
        break
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
      if (item.right) {
        item = item.right
      } else {
        this.reachedEnd = true
      }
    }
    this.index -= len
    this.nextItem = item
    return this
  }

  /**
   * @param {Transaction} tr
   */
  reduceMoves (tr) {
    let item = this.nextItem
    if (item !== null) {
      while (item === this.currMoveStart) {
        item = /** @type {Item} */ (this.currMove) // we iterate to the left after the current condition
        const { start, end, move } = this.movedStack.pop() || { start: null, end: null, move: null }
        this.currMove = move
        this.currMoveStart = start
        this.currMoveEnd = end
      }
      this.nextItem = item
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
        const { start, end, move } = this.movedStack.pop() || { start: null, end: null, move: null }
        this.currMove = move
        this.currMoveStart = start
        this.currMoveEnd = end
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
    this.index += len
    while (len > 0 && !this.reachedEnd) {
      while (this.nextItem && this.nextItem.countable && !this.reachedEnd && len > 0 && this.nextItem !== this.currMoveEnd) {
        if (!this.nextItem.deleted && this.nextItem.moved === this.currMove) {
          const item = this.nextItem
          const slicedContent = slice(item.content, this.rel, len)
          len -= slicedContent.length
          value = concat(value, slicedContent)
          if (item.length !== slicedContent.length) {
            if (this.rel + slicedContent.length === item.length) {
              this.rel = 0
            } else {
              this.rel += slicedContent.length
              continue // do not iterate to item.right
            }
          }
        }
        if (this.nextItem.right) {
          this.nextItem = this.nextItem.right
        } else {
          this.reachedEnd = true
        }
      }
      if (this.nextItem && (!this.reachedEnd || this.currMove !== null) && len > 0) {
        this.forward(tr, 0)
      }
    }
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
        this.forward(tr, 0)
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
    this.reduceMoves(tr)
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
   * @param {RelativePosition} start
   * @param {RelativePosition} end
   */
  insertMove (tr, start, end) {
    this.insertContents(tr, [new ContentMove(start, end, -1)]) // @todo adjust priority
    // @todo is there a better alrogirthm to update searchmarkers? We could simply remove the markers that are in the updated range.
    // Also note that searchmarkers are updated in insertContents as well.
    const sm = this.type._searchMarker
    if (sm) sm.length = 0
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
