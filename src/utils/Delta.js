import * as object from 'lib0/object'
import * as fun from 'lib0/function'
import * as traits from 'lib0/traits'
import * as error from 'lib0/error'

/**
 * @template {any} ArrayContent
 * @template {{[key: string]: any}} Embeds
 * @typedef {InsertStringOp|InsertEmbedOp<Embeds>|InsertArrayOp<ArrayContent>|RetainOp|DeleteOp} DeltaOp
 */

/**
 * @template {{[key: string]: any}} Embeds
 * @typedef {InsertStringOp|InsertEmbedOp<Embeds>|RetainOp|DeleteOp} TextDeltaOp
 */

/**
 * @template {any} ArrayContent
 * @typedef {InsertArrayOp<ArrayContent>|RetainOp|DeleteOp} ArrayDeltaOp
 */

/**
 * @typedef {import('./AttributionManager.js').Attribution} Attribution
 */

/**
 * @typedef {{ [key: string]: any }} FormattingAttributes
 */

/**
 * @typedef {Array<DeltaJsonOp>} DeltaJson
 */

/**
 * @typedef {{ insert: string|object, attributes?: { [key: string]: any }, attribution?: Attribution } | { delete: number } | { retain: number, attributes?: { [key:string]: any }, attribution?: Attribution }} DeltaJsonOp
 */

export class InsertStringOp {
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

  get length () {
    return (this.insert.constructor === Array || this.insert.constructor === String) ? this.insert.length : 1
  }

  /**
   * @return {DeltaJsonOp}
   */
  toJSON () {
    return object.assign({ insert: this.insert }, this.attributes ? { attributes: this.attributes } : ({}), this.attribution ? { attribution: this.attribution } : ({}))
  }

  /**
   * @param {InsertStringOp} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return fun.equalityDeep(this.insert, other.insert) && fun.equalityDeep(this.attributes, other.attributes) && fun.equalityDeep(this.attribution, other.attribution)
  }
}

/**
 * @template {any} ArrayContent
 */
export class InsertArrayOp {
  /**
   * @param {Array<ArrayContent>} insert
   * @param {FormattingAttributes|null} attributes
   * @param {Attribution|null} attribution
   */
  constructor (insert, attributes, attribution) {
    this.insert = insert
    this.attributes = attributes
    this.attribution = attribution
  }

  get length () {
    return this.insert.length
  }

  /**
   * @return {DeltaJsonOp}
   */
  toJSON () {
    return object.assign({ insert: this.insert }, this.attributes ? { attributes: this.attributes } : ({}), this.attribution ? { attribution: this.attribution } : ({}))
  }

  /**
   * @param {InsertArrayOp<ArrayContent>} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return fun.equalityDeep(this.insert, other.insert) && fun.equalityDeep(this.attributes, other.attributes) && fun.equalityDeep(this.attribution, other.attribution)
  }
}

/**
 * @template {{[key: string]: any}} Embeds
 */
export class InsertEmbedOp {
  /**
   * @param {Embeds} insert
   * @param {FormattingAttributes|null} attributes
   * @param {Attribution|null} attribution
   */
  constructor (insert, attributes, attribution) {
    this.insert = insert
    this.attributes = attributes
    this.attribution = attribution
  }

  get length () {
    return 1
  }

  /**
   * @return {DeltaJsonOp}
   */
  toJSON () {
    return object.assign({ insert: this.insert }, this.attributes ? { attributes: this.attributes } : ({}), this.attribution ? { attribution: this.attribution } : ({}))
  }

  /**
   * @param {InsertEmbedOp<Embeds>} other
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

  /**
   * @return {DeltaJsonOp}
   */
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

  /**
   * @return {DeltaJsonOp}
   */
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
 * @typedef {string | { [key: string]: any }} TextDeltaContent
 */

/**
 * @typedef {(TextDelta<any> | ArrayDelta<any>)} Delta
 */

/**
 * @template {'array' | 'text' | 'custom'} Type
 * @template {DeltaOp<any,any>} TDeltaOp
 */
export class AbstractDelta {
  /**
   * @param {Type} type
   */
  constructor (type) {
    this.type = type
    /**
     * @type {Array<TDeltaOp>}
     */
    this.ops = []
  }

  /**
   * @template {(d:TDeltaOp) => DeltaOp<any,any>} Mapper
   * @param {Mapper} f
   * @return {DeltaBuilder<Type, Mapper extends (d:TDeltaOp) => infer OP ? OP : unknown>}
   */
  map (f) {
    const d = /** @type {DeltaBuilder<Type,any>} */ (new /** @type {any} */ (this.constructor)(this.type))
    d.ops = this.ops.map(f)
    // @ts-ignore
    d.lastOp = d.ops[d.ops.length - 1] ?? null
    return d
  }

  /**
   * @param {(d:TDeltaOp,index:number)=>void} f
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
   * @param {AbstractDelta<Type, TDeltaOp>} other
   * @return {boolean}
   */
  equals (other) {
    return this[traits.EqualityTraitSymbol](other)
  }

  /**
   * @returns {DeltaJson}
   */
  toJSON () {
    return this.ops.map(o => o.toJSON())
  }

  /**
   * @param {AbstractDelta<Type,TDeltaOp>} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return fun.equalityDeep(this.ops, other.ops)
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
  const merged = object.isEmpty(a) ? b : (object.isEmpty(b) ? a : object.assign({}, a, b))
  return object.isEmpty(merged) ? null : merged
}

/**
 * @template {'array' | 'text' | 'custom'} [Type='custom']
 * @template {DeltaOp<any,any>} [TDeltaOp=DeltaOp<any,any>]
 * @extends AbstractDelta<Type,TDeltaOp>
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
     * @type {TDeltaOp?}
     */
    this.lastOp = null
  }

  /**
   * @param {FormattingAttributes?} attributes
   * @return {this}
   */
  useAttributes (attributes) {
    this.usedAttributes = object.isEmpty(attributes) ? null : object.assign({}, attributes)
    return this
  }

  /**
   * @param {string} name
   * @param {any} value
   */
  updateUsedAttributes (name, value) {
    if (value == null) {
      this.usedAttributes = object.assign({}, this.usedAttributes)
      delete this.usedAttributes?.[name]
      if (object.isEmpty(this.usedAttributes)) {
        this.usedAttributes = null
      }
    } else if (!fun.equalityDeep(this.usedAttributes?.[name], value)) {
      this.usedAttributes = object.assign({}, this.usedAttributes)
      this.usedAttributes[name] = value
    }
    return this
  }

  /**
   * @template {keyof Attribution} NAME
   * @param {NAME} name
   * @param {Attribution[NAME]?} value
   */
  updateUsedAttribution (name, value) {
    if (value == null) {
      this.usedAttribution = object.assign({}, this.usedAttribution)
      delete this.usedAttribution?.[name]
      if (object.isEmpty(this.usedAttribution)) {
        this.usedAttribution = null
      }
    } else if (!fun.equalityDeep(this.usedAttribution?.[name], value)) {
      this.usedAttribution = object.assign({}, this.usedAttribution)
      this.usedAttribution[name] = value
    }
    return this
  }

  /**
   * @param {Attribution?} attribution
   */
  useAttribution (attribution) {
    this.usedAttribution = object.isEmpty(attribution) ? null : object.assign({}, attribution)
    return this
  }

  /**
   * @param {(TDeltaOp extends TextDelta<infer Embeds> ? string | Embeds : never) | (TDeltaOp extends InsertArrayOp<infer Content> ? Array<Content> : never) } insert
   * @param {FormattingAttributes?} attributes
   * @param {Attribution?} attribution
   * @return {this}
   */
  insert (insert, attributes = null, attribution = null) {
    const mergedAttributes = mergeAttrs(this.usedAttributes, attributes)
    const mergedAttribution = mergeAttrs(this.usedAttribution, attribution)
    if (((this.lastOp instanceof InsertStringOp && insert.constructor === String) || (this.lastOp instanceof InsertArrayOp && insert.constructor === Array)) && (mergedAttributes === this.lastOp.attributes || fun.equalityDeep(mergedAttributes, this.lastOp.attributes)) && (mergedAttribution === this.lastOp.attribution || fun.equalityDeep(mergedAttribution, this.lastOp.attribution))) {
      if (insert.constructor === String) {
        // @ts-ignore
        this.lastOp.insert += insert
      } else {
        // @ts-ignore
        this.lastOp.insert.push(...insert)
      }
    } else {
      const OpConstructor = /** @type {any} */ (insert.constructor === String ? InsertStringOp : (insert.constructor === Array ? InsertArrayOp : InsertEmbedOp))
      this.ops.push(this.lastOp = new OpConstructor(insert, object.isEmpty(mergedAttributes) ? null : mergedAttributes, object.isEmpty(mergedAttribution) ? null : mergedAttribution))
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
    if (this.lastOp instanceof RetainOp && fun.equalityDeep(mergedAttributes, this.lastOp.attributes) && fun.equalityDeep(mergedAttribution, this.lastOp.attribution)) {
      this.lastOp.retain += retain
    } else {
      // @ts-ignore
      this.ops.push(this.lastOp = new RetainOp(retain, mergedAttributes, mergedAttribution))
    }
    return this
  }

  /**
   * @param {number} len
   * @return {this}
   */
  delete (len) {
    if (this.lastOp instanceof DeleteOp) {
      this.lastOp.delete += len
    } else {
      // @ts-ignore
      this.ops.push(this.lastOp = new DeleteOp(len))
    }
    return this
  }

  /**
   * @return {AbstractDelta<Type,TDeltaOp>}
   */
  done () {
    while (this.lastOp != null && this.lastOp instanceof RetainOp && this.lastOp.attributes === null) {
      this.ops.pop()
      this.lastOp = this.ops[this.ops.length - 1] ?? null
    }
    return this
  }
}

/**
 * @template {any} ArrayContent
 * @extends DeltaBuilder<'array', ArrayDeltaOp<ArrayContent>>>
 */
export class ArrayDelta extends DeltaBuilder {
  constructor () {
    super('array')
  }
}

/**
 * @template {{ [key:string]: any }} Embeds
 * @extends DeltaBuilder<'text',TextDeltaOp<Embeds>>
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
 * @return {ArrayDelta<any>}
 */
export const createArrayDelta = () => new ArrayDelta()

/**
 * @param {DeltaJson} ops
 * @param {'custom' | 'text' | 'array'} type
 */
export const fromJSON = (ops, type = 'custom') => {
  const d = new DeltaBuilder(type)
  for (let i = 0; i < ops.length; i++) {
    const op = /** @type {any} */ (ops[i])
    // @ts-ignore
    if (op.insert !== undefined) {
      d.insert(op.insert, op.attributes, op.attribution)
    } else if (op.retain !== undefined) {
      d.retain(op.retain, op.attributes ?? null, op.attribution ?? null)
    } else if (op.delete !== undefined) {
      d.delete(op.delete)
    } else {
      error.unexpectedCase()
    }
  }
  return d.done()
}
