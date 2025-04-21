import * as object from 'lib0/object'
import * as fun from 'lib0/function'

/**
 * @typedef {InsertOp|RetainOp|DeleteOp} DeltaOp
 */

/**
 * @typedef {{ [key: string]: any }} FormattingAttributes
 */

/**
 * @todo specify this better
 *
 * @typedef {Object} Attribution
 * @property {boolean} [Attribution.isDeleted]
 * @property {boolean} [Attribution.isAdded]
 * @property {string} [Attribution.creator]
 * @property {number} [Attribution.timestamp]
 */

export class InsertOp {
  /**
   * @param {string} insert
   * @param {FormattingAttributes|null} attributes
   * @param {Attribution|null} attribution
   */
  constructor (insert, attributes, attribution) {
    this.insert = insert
    this.attributes = attributes
    this.attribution = attribution
  }

  toJSON () {
    return object.assign({ insert: this.insert }, this.attributes ? { attributes: this.attributes } : ({}), this.attribution ? { attribution: this.attribution } : ({}))
  }
}

export class DeleteOp {
  /**
   * @param {number} len
   */
  constructor (len) {
    this.delete = len
  }

  toJSON () {
    return { delete: this.delete }
  }
}

export class RetainOp {
  /**
   * @param {number} retain
   * @param {FormattingAttributes|null} attributes
   * @param {Attribution|null} attribution
   */
  constructor (retain, attributes, attribution) {
    this.retain = retain
    this.attributes = attributes
    this.attribution = attribution
  }

  toJSON () {
    return object.assign({ retain: this.retain }, this.attributes ? { attributes: this.attributes } : {}, this.attribution ? { attribution: this.attribution } : {})
  }
}

export class Delta {
  constructor () {
    /**
     * @type {Array<DeltaOp>}
     */
    this.ops = []
  }

  /**
   * @param {Delta} d
   * @return {boolean}
   */
  equals (d) {
    return this.ops.length === d.ops.length && this.ops.every((op, i) => {
      const dop = d.ops[i]
      if (op.constructor !== dop.constructor) return false
      switch (op.constructor) {
        case DeleteOp: {
          if (/** @type {DeleteOp} */ (op).delete !== /** @type {DeleteOp} */ (dop).delete) {
            return false
          }
          break
        }
        case InsertOp: {
          if (
            !fun.equalityDeep(/** @type {InsertOp} */ (op).insert, /** @type {InsertOp} */ (dop).insert)
            || !fun.equalityDeep(/** @type {InsertOp} */ (op).attributes, /** @type {InsertOp} */ (dop).attributes)
            || !fun.equalityDeep(/** @type {InsertOp} */ (op).attribution, /** @type {InsertOp} */ (dop).attribution)
          ) {
            return false
          }
          break
        }
        case RetainOp: {
          if (
            /** @type {RetainOp} */ (op).retain !== /** @type {RetainOp} */ (dop).retain
            || !fun.equalityDeep(/** @type {RetainOp} */ (op).attributes, /** @type {RetainOp} */ (dop).attributes)
            || !fun.equalityDeep(/** @type {RetainOp} */ (op).attribution, /** @type {RetainOp} */ (dop).attribution)
          ) {
            return false
          }
          break
        }
      }
      return true
    })
  }

  toJSON () {
    return { ops: this.ops.map(o => o.toJSON()) }
  }
}

/**
 * Helper function to merge attribution and attributes. The latter input "wins".
 *
 * @template {{ [key: string]: any }} T
 * @param {T | null} a
 * @param {T | null} b
 */
const mergeAttrs = (a, b) => {
  const merged = a == null ? b : (b == null ? a : object.assign({}, a, b))
  if (object.isEmpty(merged ?? {})) { return null }
  return merged
}

export class DeltaBuilder extends Delta {
  constructor () {
    super()
    /**
     * @private
     * @type {FormattingAttributes?}
     */
    this._useAttributes = null
    /**
     * @private
     * @type {Attribution?}
     */
    this._useAttribution = null
    /**
     * @private
     * @type {DeltaOp?}
     */
    this._lastOp = null
  }

  /**
   * @param {FormattingAttributes?} attributes
   * @return {this}
   */
  useAttributes (attributes) {
    if (this._useAttributes === attributes) return this
    this._useAttributes = attributes && object.assign({}, attributes)
    return this
  }

  /**
   * @param {Attribution?} attribution
   */
  useAttribution (attribution) {
    if (this._useAttribution === attribution) return this
    this._useAttribution = attribution && object.assign({}, attribution)
    return this
  }

  /**
   * @param {string} insert
   * @param {FormattingAttributes?} attributes
   * @param {Attribution?} attribution
   * @return {this}
   */
  insert (insert, attributes = null, attribution = null) {
    const mergedAttributes = mergeAttrs(this._useAttributes, attributes)
    const mergedAttribution = mergeAttrs(this._useAttribution, attribution)
    if (this._lastOp instanceof InsertOp && fun.equalityDeep(mergedAttributes, this._lastOp.attributes) && fun.equalityDeep(mergedAttribution, this._lastOp.attribution)) {
      this._lastOp.insert += insert
    } else {
      this.ops.push(this._lastOp = new InsertOp(insert, mergedAttributes, mergedAttribution))
    }
    return this
  }

  /**
   * @param {number} retain
   * @param {FormattingAttributes?} attributes
   * @param {Attribution?} attribution
   * @return {this}
   */
  retain (retain, attributes = null, attribution = null) {
    const mergedAttributes = mergeAttrs(this._useAttributes, attributes)
    const mergedAttribution = mergeAttrs(this._useAttribution, attribution)
    if (this._lastOp instanceof RetainOp && fun.equalityDeep(mergedAttributes, this._lastOp.attributes) && fun.equalityDeep(mergedAttribution, this._lastOp.attribution)) {
      this._lastOp.retain += retain
    } else {
      this.ops.push(this._lastOp = new RetainOp(retain, mergedAttributes, mergedAttribution))
    }
    return this
  }

  /**
   * @param {number} len
   * @return {this}
   */
  delete (len) {
    if (this._lastOp instanceof DeleteOp) {
      this._lastOp.delete += len
    } else {
      this.ops.push(this._lastOp = new DeleteOp(len))
    }
    return this
  }

  /**
   * @return {Delta}
   */
  done () {
    return this
  }
}

export const create = () => new DeltaBuilder()
