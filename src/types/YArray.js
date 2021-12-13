/**
 * @module YArray
 */

import {
  YEvent,
  AbstractType,
  YArrayRefID,
  callTypeObservers,
  transact,
  ListIterator,
  useSearchMarker,
  createRelativePositionFromTypeIndex,
  UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, Doc, Transaction, Item // eslint-disable-line
} from '../internals.js'

/**
 * Event that describes the changes on a YArray
 * @template T
 */
export class YArrayEvent extends YEvent {
  /**
   * @param {YArray<T>} yarray The changed type
   * @param {Transaction} transaction The transaction object
   */
  constructor (yarray, transaction) {
    super(yarray, transaction)
    this._transaction = transaction
  }
}

/**
 * A shared Array implementation.
 * @template T
 * @extends AbstractType<YArrayEvent<T>>
 * @implements {Iterable<T>}
 */
export class YArray extends AbstractType {
  constructor () {
    super()
    /**
     * @type {Array<any>?}
     * @private
     */
    this._prelimContent = []
    /**
     * @type {Array<ListIterator>}
     */
    this._searchMarker = []
  }

  /**
   * Construct a new YArray containing the specified items.
   * @template T
   * @param {Array<T>} items
   * @return {YArray<T>}
   */
  static from (items) {
    const a = new YArray()
    a.push(items)
    return a
  }

  /**
   * Integrate this type into the Yjs instance.
   *
   * * Save this struct in the os
   * * This type is sent to other client
   * * Observer functions are fired
   *
   * @param {Doc} y The Yjs instance
   * @param {Item} item
   */
  _integrate (y, item) {
    super._integrate(y, item)
    this.insert(0, /** @type {Array<any>} */ (this._prelimContent))
    this._prelimContent = null
  }

  _copy () {
    return new YArray()
  }

  /**
   * @return {YArray<T>}
   */
  clone () {
    const arr = new YArray()
    arr.insert(0, this.toArray().map(el =>
      el instanceof AbstractType ? el.clone() : el
    ))
    return arr
  }

  get length () {
    return this._prelimContent === null ? this._length : this._prelimContent.length
  }

  /**
   * Creates YArrayEvent and calls observers.
   *
   * @param {Transaction} transaction
   * @param {Set<null|string>} parentSubs Keys changed on this type. `null` if list was modified.
   */
  _callObserver (transaction, parentSubs) {
    super._callObserver(transaction, parentSubs)
    callTypeObservers(this, transaction, new YArrayEvent(this, transaction))
  }

  /**
   * Inserts new content at an index.
   *
   * Important: This function expects an array of content. Not just a content
   * object. The reason for this "weirdness" is that inserting several elements
   * is very efficient when it is done as a single operation.
   *
   * @example
   *  // Insert character 'a' at position 0
   *  yarray.insert(0, ['a'])
   *  // Insert numbers 1, 2 at position 1
   *  yarray.insert(1, [1, 2])
   *
   * @param {number} index The index to insert content at.
   * @param {Array<T>} content The array of content
   */
  insert (index, content) {
    if (content.length > 0) {
      if (this.doc !== null) {
        transact(this.doc, transaction => {
          useSearchMarker(transaction, this, index, walker =>
            walker.insertArrayValue(transaction, content)
          )
        })
      } else {
        /** @type {Array<any>} */ (this._prelimContent).splice(index, 0, ...content)
      }
    }
  }

  /**
   * Move a single item from $index to $target.
   *
   * @todo make sure that collapsed moves are removed (i.e. when moving the same item twice)
   *
   * @param {number} index
   * @param {number} target
   */
  move (index, target) {
    if (index === target || index + 1 === target || index >= this.length) {
      // It doesn't make sense to move a range into the same range (it's basically a no-op).
      return
    }
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        const left = createRelativePositionFromTypeIndex(this, index, 1)
        const right = left.clone()
        right.assoc = -1
        useSearchMarker(transaction, this, target, walker => {
          walker.insertMove(transaction, left, right)
        })
      })
    } else {
      const content = /** @type {Array<any>} */ (this._prelimContent).splice(index, 1)
      ;/** @type {Array<any>} */ (this._prelimContent).splice(target, 0, ...content)
    }
  }

  /**
   * @param {number} start Inclusive move-start
   * @param {number} end Inclusive move-end
   * @param {number} target
   * @param {number} assocStart >=0 if start should be associated with the right character. See relative-position assoc parameter.
   * @param {number} assocEnd >= 0 if end should be associated with the right character.
   */
  moveRange (start, end, target, assocStart = 1, assocEnd = -1) {
    if (start <= target && target <= end) {
      // It doesn't make sense to move a range into the same range (it's basically a no-op).
      return
    }
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        const left = createRelativePositionFromTypeIndex(this, start, assocStart)
        const right = createRelativePositionFromTypeIndex(this, end + 1, assocEnd)
        useSearchMarker(transaction, this, target, walker => {
          walker.insertMove(transaction, left, right)
        })
      })
    } else {
      const content = /** @type {Array<any>} */ (this._prelimContent).splice(start, end - start + 1)
      ;/** @type {Array<any>} */ (this._prelimContent).splice(target, 0, ...content)
    }
  }

  /**
   * Appends content to this YArray.
   *
   * @param {Array<T>} content Array of content to append.
   */
  push (content) {
    this.insert(this.length, content)
  }

  /**
   * Preppends content to this YArray.
   *
   * @param {Array<T>} content Array of content to preppend.
   */
  unshift (content) {
    this.insert(0, content)
  }

  /**
   * Deletes elements starting from an index.
   *
   * @param {number} index Index at which to start deleting elements
   * @param {number} length The number of elements to remove. Defaults to 1.
   */
  delete (index, length = 1) {
    if (this.doc !== null) {
      transact(this.doc, transaction => {
        useSearchMarker(transaction, this, index, walker =>
          walker.delete(transaction, length)
        )
      })
    } else {
      /** @type {Array<any>} */ (this._prelimContent).splice(index, length)
    }
  }

  /**
   * Returns the i-th element from a YArray.
   *
   * @param {number} index The index of the element to return from the YArray
   * @return {T}
   */
  get (index) {
    return transact(/** @type {Doc} */ (this.doc), transaction =>
      useSearchMarker(transaction, this, index, walker =>
        walker.slice(transaction, 1)[0]
      )
    )
  }

  /**
   * Transforms this YArray to a JavaScript Array.
   *
   * @return {Array<T>}
   */
  toArray () {
    return transact(/** @type {Doc} */ (this.doc), tr =>
      new ListIterator(this).slice(tr, this.length)
    )
  }

  /**
   * Transforms this YArray to a JavaScript Array.
   *
   * @param {number} [start]
   * @param {number} [end]
   * @return {Array<T>}
   */
  slice (start = 0, end = this.length) {
    return transact(/** @type {Doc} */ (this.doc), transaction =>
      useSearchMarker(transaction, this, start, walker =>
        walker.slice(transaction, end < 0 ? this.length + end - start : end - start)
      )
    )
  }

  /**
   * Transforms this Shared Type to a JSON object.
   *
   * @return {Array<any>}
   */
  toJSON () {
    return this.map(c => c instanceof AbstractType ? c.toJSON() : c)
  }

  /**
   * Returns an Array with the result of calling a provided function on every
   * element of this YArray.
   *
   * @template M
   * @param {function(T,number,YArray<T>):M} f Function that produces an element of the new Array
   * @return {Array<M>} A new array with each element being the result of the
   *                 callback function
   */
  map (f) {
    return transact(/** @type {Doc} */ (this.doc), tr =>
      new ListIterator(this).map(tr, f)
    )
  }

  /**
   * Executes a provided function on once on overy element of this YArray.
   *
   * @param {function(T,number,YArray<T>):void} f A function to execute on every element of this YArray.
   */
  forEach (f) {
    return transact(/** @type {Doc} */ (this.doc), tr =>
      new ListIterator(this).forEach(tr, f)
    )
  }

  /**
   * @return {IterableIterator<T>}
   */
  [Symbol.iterator] () {
    return this.toArray().values()
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   */
  _write (encoder) {
    encoder.writeTypeRef(YArrayRefID)
  }
}

/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
 *
 * @private
 * @function
 */
export const readYArray = decoder => new YArray()
