import * as object from 'lib0/object'
import * as fun from 'lib0/function'
import * as traits from 'lib0/traits'

/**
 * @template {string|Array<any>|{[key: string]: any}} Content
 * @typedef {InsertOp<Content>|RetainOp|DeleteOp} DeltaOp
 */

/**
 * @typedef {import('./AttributionManager.js').Attribution} Attribution
 */

/**
 * @typedef {{ [key: string]: any }} FormattingAttributes
 */

/**
 * @template {string|Array<any>|{[key: string]: any}} Content
 */
export class InsertOp {
  /**
   * @param {Content} insert
   * @param {FormattingAttributes|null} attributes
   * @param {Attribution|null} attribution
   */
  constructor (insert, attributes, attribution) {
    this.insert = insert
    this.attributes = attributes
    this.attribution = attribution
  }

  get length () {
    return (this.insert.constructor === Array || this.insert.constructor === String) ? this.insert.length : 1
  }

  toJSON () {
    return object.assign({ insert: this.insert }, this.attributes ? { attributes: this.attributes } : ({}), this.attribution ? { attribution: this.attribution } : ({}))
  }

  /**
   * @param {InsertOp<Content>} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return fun.equalityDeep(this.insert, other.insert) && fun.equalityDeep(this.attributes, other.attributes) && fun.equalityDeep(this.attribution, other.attribution)
  }
}

export class DeleteOp {
  /**
   * @param {number} len
   */
  constructor (len) {
    this.delete = len
  }

  get length () {
    return 0
  }

  toJSON () {
    return { delete: this.delete }
  }

  /**
   * @param {DeleteOp} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return this.delete === other.delete
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

  get length () {
    return this.retain
  }

  toJSON () {
    return object.assign({ retain: this.retain }, this.attributes ? { attributes: this.attributes } : {}, this.attribution ? { attribution: this.attribution } : {})
  }

  /**
   * @param {RetainOp} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return this.retain === other.retain && fun.equalityDeep(this.attributes, other.attributes) && fun.equalityDeep(this.attribution, other.attribution)
  }
}

/**
 * @typedef {Array<any>} ArrayDeltaContent
 */

/**
 * @typedef {string | { [key: string]: any }} TextDeltaContent
 */

/**
 * @typedef {{ array: ArrayDeltaContent, text: TextDeltaContent, custom: string|Array<any>|{[key:string]:any}}} DeltaTypeMapper
 */

/**
 * @typedef {(TextDelta | ArrayDelta)} Delta
 */

/**
 * @template {'array' | 'text' | 'custom'} Type
 * @template {DeltaTypeMapper[Type]} [Content=DeltaTypeMapper[Type]]
 */
export class AbstractDelta {
  /**
   * @param {Type} type
   */
  constructor (type) {
    this.type = type
    /**
     * @type {Array<DeltaOp<Content>>}
     */
    this.ops = []
  }

  /**
   * @template {DeltaTypeMapper[Type]} MContent
   * @param {(d:DeltaOp<Content>)=>DeltaOp<MContent>} f
   * @return {DeltaBuilder<Type, MContent>}
   */
  map (f) {
    const d = /** @type {DeltaBuilder<Type,any>} */ (new /** @type {any} */ (this.constructor)(this.type))
    d.ops = this.ops.map(f)
    // @ts-ignore
    d._lastOp = d.ops[d.ops.length - 1] ?? null
    return d
  }

  /**
   * @param {(d:DeltaOp<Content>,index:number)=>void} f
   */
  forEach (f) {
    for (
      let i = 0, index = 0, op = this.ops[i];
      i < this.ops.length;
      i++, index += op.length, op = this.ops[i]
    ) {
      f(op, index)
    }
  }

  /**
   * @param {AbstractDelta<Type, Content>} other
   * @return {boolean}
   */
  equals (other) {
    return this[traits.EqualityTraitSymbol](other)
  }

  toJSON () {
    return { ops: this.ops.map(o => o.toJSON()) }
  }

  /**
   * @param {AbstractDelta<Type,Content>} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return this.type === other.type && fun.equalityDeep(this.ops, other.ops)
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
  if (merged == null || object.isEmpty(merged)) { return null }
  return merged
}

/**
 * @template {'array' | 'text' | 'custom'} [Type='custom']
 * @template {DeltaTypeMapper[Type]} [Content=DeltaTypeMapper[Type]]
 * @extends AbstractDelta<Type,Content>
 */
export class DeltaBuilder extends AbstractDelta {
  /**
   * @param {Type} type
   */
  constructor (type) {
    super(type)
    /**
     * @type {FormattingAttributes?}
     */
    this.usedAttributes = null
    /**
     * @type {Attribution?}
     */
    this.usedAttribution = null
    /**
     * @private
     * @type {DeltaOp<Content>?}
     */
    this._lastOp = null
  }

  /**
   * @param {FormattingAttributes?} attributes
   * @return {this}
   */
  useAttributes (attributes) {
    if (this.usedAttributes === attributes) return this
    this.usedAttributes = attributes && (object.isEmpty(attributes) ? null : object.assign({}, attributes))
    return this
  }

  /**
   * @param {Attribution?} attribution
   */
  useAttribution (attribution) {
    if (this.usedAttribution === attribution) return this
    this.usedAttribution = attribution && (object.isEmpty(attribution) ? null : object.assign({}, attribution))
    return this
  }

  /**
   * @param {Content} insert
   * @param {FormattingAttributes?} attributes
   * @param {Attribution?} attribution
   * @return {this}
   */
  insert (insert, attributes = null, attribution = null) {
    const mergedAttributes = attributes == null ? this.usedAttributes : mergeAttrs(this.usedAttributes, attributes)
    const mergedAttribution = attribution == null ? this.usedAttribution : mergeAttrs(this.usedAttribution, attribution)
    if (this._lastOp instanceof InsertOp && (mergedAttributes === this._lastOp.attributes || fun.equalityDeep(mergedAttributes, this._lastOp.attributes)) && (mergedAttribution === this._lastOp.attribution || fun.equalityDeep(mergedAttribution, this._lastOp.attribution))) {
      if (insert.constructor === String) {
        // @ts-ignore
        this._lastOp.insert += insert
      } else if (insert.constructor === Array && this._lastOp.insert.constructor === Array) {
        // @ts-ignore
        this._lastOp.insert.push(...insert)
      } else {
        this.ops.push(this._lastOp = new InsertOp(insert, mergedAttributes, mergedAttribution))
      }
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
    const mergedAttributes = mergeAttrs(this.usedAttributes, attributes)
    const mergedAttribution = mergeAttrs(this.usedAttribution, attribution)
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
   * @return {AbstractDelta<Type,Content>}
   */
  done () {
    return this
  }
}

/**
 * @template {ArrayDeltaContent} [Content=ArrayDeltaContent]
 * @extends DeltaBuilder<'array',Content>
 */
export class ArrayDelta extends DeltaBuilder {
  constructor () {
    super('array')
  }
}

/**
 * @template {TextDeltaContent} [Content=TextDeltaContent]
 * @extends DeltaBuilder<'text',Content>
 */
export class TextDelta extends DeltaBuilder {
  constructor () {
    super('text')
  }
}

/**
 * @return {TextDelta<TextDeltaContent>}
 */
export const createTextDelta = () => new TextDelta()

/**
 * @return {ArrayDelta<ArrayDeltaContent>}
 */
export const createArrayDelta = () => new ArrayDelta()
