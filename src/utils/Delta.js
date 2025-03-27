import * as object from 'lib0/object'

/**
 * @typedef {InsertOp|RetainOp|DeleteOp} DeltaOp
 */

/**
 * @typedef {{ [key: string]: any }} FormattingAttributes
 */

/**
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
const mergeAttrs = (a, b) => a == null ? b : (b == null ? a : object.assign({}, a, b))

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
   * @param {FormattingAttributes} attributes
   * @return {this}
   */
  useAttributes (attributes) {
    if (this._useAttributes === attributes) return this
    this._useAttributes = object.assign({}, attributes)
    if (this._lastOp?.constructor !== DeleteOp) this._lastOp = null
    return this
  }

  /**
   * @param {Attribution} attribution
   */
  useAttribution (attribution) {
    if (this._useAttribution === attribution) return this
    this._useAttribution = object.assign({}, attribution)
    if (this._lastOp?.constructor !== DeleteOp) this._lastOp = null
    return this
  }

  /**
   * @param {string} insert
   * @param {FormattingAttributes?} attributes
   * @param {Attribution?} attribution
   * @return {this}
   */
  insert (insert, attributes = null, attribution = null) {
    if (attributes === null && attribution === null && this._lastOp instanceof InsertOp) {
      this._lastOp.insert += insert
    } else {
      this.ops.push(this._lastOp = new InsertOp(insert, mergeAttrs(this._useAttributes, attributes), mergeAttrs(this._useAttribution, attribution)))
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
    if (attributes === null && attribution === null && this._lastOp instanceof RetainOp) {
      this._lastOp.retain += retain
    } else {
      this.ops.push(this._lastOp = new RetainOp(retain, mergeAttrs(this._useAttributes, attributes), mergeAttrs(this._useAttribution, attribution)))
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
