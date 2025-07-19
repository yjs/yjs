import * as object from 'lib0/object'
import * as map from 'lib0/map'
import * as fun from 'lib0/function'
import * as traits from 'lib0/traits'
import * as error from 'lib0/error'
import * as s from 'lib0/schema'
import { attributionJsonSchema } from './AttributionManager.js'

/**
 * @template {any} ArrayContent
 * @template {object} Embeds
 * @template {Delta|undefined} ModifyingDelta
 * @typedef {InsertStringOp|InsertEmbedOp<Embeds>|InsertArrayOp<ArrayContent>|RetainOp|DeleteOp|(ModifyingDelta extends undefined ? never : ModifyOp<ModifyingDelta extends undefined ? never : ModifyingDelta>)} DeltaOp
 */

/**
 * @template {object} Embeds
 * @template {Delta|undefined} Modifiers
 * @typedef {InsertStringOp|InsertEmbedOp<Embeds>|RetainOp|DeleteOp|(Modifiers extends undefined ? never : ModifyOp<Modifiers extends undefined ? never : Modifiers>)} TextDeltaOp
 */

/**
 * @template ArrayContent
 * @typedef {InsertArrayOp<ArrayContent>|RetainOp|DeleteOp} ArrayDeltaOp
 */

/**
 * @typedef {import('./AttributionManager.js').Attribution} Attribution_
 */

/**
 * @typedef {{ [key: string]: any }} FormattingAttributes
 */

/**
 * @typedef {Array<DeltaJsonOp>} DeltaJson
 */

/**
 * @typedef {{ insert: string|object, attributes?: { [key: string]: any }, attribution?: Attribution_ } | { delete: number } | { retain: number, attributes?: { [key:string]: any }, attribution?: Attribution_ } | { modify: object }} DeltaJsonOp
 */

export class InsertStringOp {
  /**
   * @param {string} insert
   * @param {FormattingAttributes|null} attributes
   * @param {Attribution_|null} attribution
   */
  constructor (insert, attributes, attribution) {
    this.insert = insert
    this.attributes = attributes
    this.attribution = attribution
  }

  /**
   * @return {'insert'}
   */
  get type () {
    return 'insert'
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
   * @param {Attribution_|null} attribution
   */
  constructor (insert, attributes, attribution) {
    this.insert = insert
    this.attributes = attributes
    this.attribution = attribution
  }

  /**
   * @return {'insert'}
   */
  get type () {
    return 'insert'
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
 * @template {object} Embeds
 */
export class InsertEmbedOp {
  /**
   * @param {Embeds} insert
   * @param {FormattingAttributes|null} attributes
   * @param {Attribution_|null} attribution
   */
  constructor (insert, attributes, attribution) {
    this.insert = insert
    this.attributes = attributes
    this.attribution = attribution
  }

  /**
   * @return {'insertEmbed'}
   */
  get type () {
    return 'insertEmbed'
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

  /**
   * @return {'delete'}
   */
  get type () {
    return 'delete'
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
   * @param {Attribution_|null} attribution
   */
  constructor (retain, attributes, attribution) {
    this.retain = retain
    this.attributes = attributes
    this.attribution = attribution
  }

  /**
   * @return {'retain'}
   */
  get type () {
    return 'retain'
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
 * Delta that can be applied on a YType Embed
 *
 * @template {Delta} DTypes
 */
export class ModifyOp {
  /**
   * @param {DTypes} delta
   */
  constructor (delta) {
    this.modify = delta
  }

  /**
   * @return {'modify'}
   */
  get type () {
    return 'modify'
  }

  get length () {
    return 1
  }

  /**
   * @return {DeltaJsonOp}
   */
  toJSON () {
    return { modify: this.modify.toJSON() }
  }

  /**
   * @param {ModifyOp<any>} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return this.modify[traits.EqualityTraitSymbol](other.modify)
  }
}

export class AbstractDelta {
  constructor () {
    this.remote = false
    /**
     * @type {any} origin
     */
    this.origin = null
    this.isDiff = true
  }

  /**
   * @param {any} _other
   */
  [traits.EqualityTraitSymbol] (_other) {
    error.methodUnimplemented()
  }
}

/**
 * @template {Delta|undefined} [Modifiers=any]
 * @typedef {(TextDelta<any,Modifiers> | ArrayDelta<any,Modifiers> | MapDelta<object,Modifiers> | XmlDelta<string,any,any,Modifiers,Modifiers> )} Delta
 */

/**
 * @template {'array' | 'text' | 'custom'} Type
 * @template {DeltaOp<any,any,Modifiers>} TDeltaOp
 * @template {Delta|undefined} Modifiers
 */
export class AbstractArrayDelta extends AbstractDelta {
  /**
   * @param {Type} type
   */
  constructor (type) {
    super()
    this.type = type
    /**
     * @type {Array<TDeltaOp>}
     */
    this.ops = []
  }

  /**
   * @template {(d:TDeltaOp) => DeltaOp<any,any,any>} Mapper
   * @param {Mapper} f
   * @return {AbstractArrayDeltaBuilder<Type, Mapper extends (d:TDeltaOp) => infer OP ? OP : unknown,Modifiers>}
   */
  map (f) {
    const d = /** @type {AbstractArrayDeltaBuilder<Type,any,Modifiers>} */ (new /** @type {any} */ (this.constructor)(this.type))
    d.ops = this.ops.map(f)
    // @ts-ignore
    d.lastOp = d.ops[d.ops.length - 1] ?? null
    return d
  }

  /**
   *
   * Iterate through the changes. There are two approches to iterate through the changes. The
   * following examples achieve the same thing:
   *
   * @example
   *   d.forEach((op, index) => {
   *     if (op instanceof delta.InsertArrayOp) {
   *       op.insert
   *     } else if (op instanceof delta.RetainOp ) {
   *       op.retain
   *     } else if (op instanceof delta.DeleteOp) {
   *       op.delete
   *     }
   *   })
   *
   * The second approach doesn't require instanceof checks.
   *
   * @example
   *   d.forEach(null,
   *     (insertOp, index) => insertOp.insert,
   *     (retainOp, index) => insertOp.retain
   *     (deleteOp, index) => insertOp.delete
   *   )
   *
   * @param {null|((d:TDeltaOp,index:number)=>void)} f
   * @param {null|((insertOp:Exclude<TDeltaOp,RetainOp|DeleteOp|ModifyOp<any>>,index:number)=>void)} insertHandler
   * @param {null|((retainOp:RetainOp,index:number)=>void)} retainHandler
   * @param {null|((deleteOp:DeleteOp,index:number)=>void)} deleteHandler
   * @param {null|(Modifiers extends undefined ? null : ((modifyOp:ModifyOp<Modifiers extends undefined ? never : Modifiers>,index:number)=>void))} modifyHandler
   */
  forEach (f = null, insertHandler = null, retainHandler = null, deleteHandler = null, modifyHandler = null) {
    for (
      let i = 0, index = 0, op = this.ops[i];
      i < this.ops.length;
      i++, index += op.length, op = this.ops[i]
    ) {
      f?.(op, index)
      switch (op.constructor) {
        case RetainOp:
          retainHandler?.(/** @type {RetainOp} */ (op), index)
          break
        case DeleteOp:
          deleteHandler?.(/** @type {DeleteOp} */ (op), index)
          break
        case ModifyOp:
          modifyHandler?.(/** @type {any}) */ (op), index)
          break
        default:
          insertHandler?.(/** @type {any} */ (op), index)
      }
    }
  }

  /**
   * @param {AbstractArrayDelta<Type,TDeltaOp,any>} other
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
   * @param {AbstractArrayDelta<Type,TDeltaOp,any>} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return fun.equalityDeep(this.ops, other.ops)
  }
}

/**
 * @template {object} Vals
 * @template {keyof Vals} K
 * @template {Delta|undefined} Modifiers
 * @typedef {(change:MapDeltaChange<Vals[K],Modifiers>,key:K) => void} MapDeltaChangeCallback
 */

/**
 * @template V
 */
class MapInsertOp {
  /**
   * @param {V} value
   * @param {V|undefined} prevValue
   * @param {Attribution_?} attribution
   */
  constructor (value, prevValue, attribution) {
    this.prevValue = prevValue
    this.attribution = attribution
    this.value = value
  }

  /**
   * @return {'insert'}
   */
  get type () { return 'insert' }

  toJSON () {
    return {
      type: this.type,
      value: this.value,
      prevValue: this.prevValue,
      attribution: this.attribution
    }
  }

  /**
   * @param {MapInsertOp<V>} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return fun.equalityDeep(this.value, other.value) && fun.equalityDeep(this.prevValue, other.prevValue) && fun.equalityDeep(this.attribution, other.attribution)
  }
}

/**
 * @template V
 */
class MapDeleteOp {
  /**
   * @param {V|undefined} prevValue
   * @param {Attribution_?} attribution
   */
  constructor (prevValue, attribution) {
    this.prevValue = prevValue
    this.attribution = attribution
  }

  get value () { return undefined }

  /**
   * @type {'delete'}
   */
  get type () { return 'delete' }

  toJSON () {
    return {
      type: this.type,
      prevValue: this.prevValue,
      attribution: this.attribution
    }
  }

  /**
   * @param {MapDeleteOp<V>} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return fun.equalityDeep(this.prevValue, other.prevValue) && fun.equalityDeep(this.attribution, other.attribution)
  }
}

/**
 * @template {Delta} Modifiers
 */
class MapModifyOp {
  /**
   * @param {Modifiers} delta
   */
  constructor (delta) {
    this.modify = delta
  }

  get value () { return undefined }

  /**
   * @type {'modify'}
   */
  get type () { return 'modify' }

  toJSON () {
    return {
      type: this.type,
      modify: this.modify.toJSON()
    }
  }

  /**
   * @param {MapModifyOp<Modifiers>} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return this.modify[traits.EqualityTraitSymbol](other.modify)
  }
}

/**
 * @template V
 * @template {Delta|undefined} Modifiers
 * @typedef {MapInsertOp<V> | MapDeleteOp<V> | (Modifiers extends undefined ? never : MapModifyOp<Modifiers extends undefined ? never : Modifiers>)} MapDeltaChange
 */

export const mapDeltaChangeJsonSchema = s.union(
  s.object({ type: s.literal('insert'), value: s.any, prevValue: s.any.optional, attribution: attributionJsonSchema.nullable.optional }),
  s.object({ type: s.literal('delete'), prevValue: s.any.optional, attribution: attributionJsonSchema.nullable.optional }),
  s.object({ type: s.literal('modify'), modify: s.any })
)

export const mapDeltaJsonSchema = s.record(s.string, mapDeltaChangeJsonSchema)

/**
 * @template {object} Vals
 * @template {Delta|undefined} Modifiers
 */
export class MapDelta extends AbstractDelta {
  constructor () {
    super()
    /**
     * @type {Map<keyof Vals,MapDeltaChange<Vals[keyof Vals],Modifiers>>}
     */
    this.changes = map.create()
    /**
     * @type {Attribution_?}
     */
    this.usedAttribution = null
  }

  /**
   *
   * Iterate through the changes. There are two approches to iterate through changes. The
   * following two examples achieve the same thing:
   *
   * @example
   *   d.forEach((op, index) => {
   *     if (op instanceof delta.InsertArrayOp) {
   *       op.insert
   *     } else if (op instanceof delta.RetainOp ) {
   *       op.retain
   *     } else if (op instanceof delta.DeleteOp) {
   *       op.delete
   *     } else if (op instanceof delta.ModifyOp) {
   *       op.modify
   *     }
   *   })
   *
   * The second approach doesn't require instanceof checks.
   *
   * @example
   *   d.forEach(null,
   *     (insertOp, index) => insertOp.insert,
   *     (retainOp, index) => insertOp.retain
   *     (deleteOp, index) => insertOp.delete
   *     (modifyOp, index) => insertOp.modify
   *   )
   *
   * @param {null|((change:MapDeltaChange<Vals[keyof Vals],Modifiers>,key:keyof Vals)=>void)} changeHandler
   * @param {null|((insertOp:MapInsertOp<Vals[keyof Vals]>,key:keyof Vals)=>void)} insertHandler
   * @param {null|((deleteOp:MapDeleteOp<Vals[keyof Vals]>,key:keyof Vals)=>void)} deleteHandler
   * @param {null|((modifyOp:(MapModifyOp<Modifiers extends undefined ? never : Modifiers>),key:keyof Vals)=>void)} modifyHandler
   */
  forEach (changeHandler = null, insertHandler = null, deleteHandler = null, modifyHandler = null) {
    this.changes.forEach((change, key) => {
      changeHandler?.(change, key)
      switch (change.constructor) {
        case MapDeleteOp:
          deleteHandler?.(/** @type {MapDeleteOp<Vals[keyof Vals]>} */ (change), key)
          break
        case MapInsertOp:
          insertHandler?.(/** @type {MapInsertOp<Vals[keyof Vals]>} */ (change), key)
          break
        case MapModifyOp:
          modifyHandler?.(/** @type {MapModifyOp<Modifiers extends undefined ? never : Modifiers>} */ (change), key)
          break
      }
    })
  }

  /**
   * @template {keyof Vals} K
   *
   * @param {K} key
   * @return {MapDeltaChange<Vals[K],Modifiers> | undefined}
   */
  get (key) {
    return /** @type {MapDeltaChange<Vals[K],Modifiers> | undefined} */ (this.changes.get(key))
  }

  /**
   * @param {keyof Vals} key
   */
  has (key) {
    return this.changes.has(key)
  }

  /**
   * @param {MapDelta<any,any>} other
   * @return {boolean}
   */
  equals (other) {
    return this[traits.EqualityTraitSymbol](other)
  }

  /**
   * @return {s.Unwrap<typeof mapDeltaJsonSchema>}
   */
  toJSON () {
    /**
     * @type {s.Unwrap<typeof mapDeltaJsonSchema>}
     */
    const changes = {}
    this.changes.forEach((change, key) => {
      changes[/** @type {string} */ (key)] = change.toJSON()
    })
    return changes
  }

  /**
   * Preferred way to iterate through changes.
   *
   * @return {IterableIterator<{ [K in keyof Vals]: [K, MapDeltaChange<Vals[K],Modifiers>] }[keyof Vals]>}
   */
  [Symbol.iterator] () {
    // @ts-ignore
    return this.changes.entries()
  }

  /**
   * @param {MapDelta<any,any>} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return fun.equalityDeep(this.changes, other.changes)
  }

  /**
   * @return {MapDelta<Vals,Modifiers>}
   */
  done () {
    return this
  }
}

/**
 * @template {string|undefined} NodeName
 * @template Children
 * @template {object} Attrs
 * @template {Delta|undefined} [ChildModifiers=undefined]
 * @template {Delta|undefined} [AttrModifiers=undefined]
 * @template {'done'|'mutable'} [Done='mutable']
 */
export class XmlDelta extends AbstractDelta {
  /**
   * @param {NodeName} nodeName
   * @param {ArrayDeltaBuilder<Children,ChildModifiers>} children
   * @param {MapDelta<Attrs,AttrModifiers>} attributes
   */
  constructor (nodeName, children, attributes) {
    super()
    this.nodeName = nodeName
    /**
     * @type {ArrayDeltaBuilder<Children,ChildModifiers>}
     */
    this.children = children
    /**
     * @type {Done extends 'mutable' ? MapDeltaBuilder<Attrs> : MapDelta<Attrs,AttrModifiers>}
     */
    this.attributes = /** @type {any} */ (attributes)
  }

  toJSON () {
    return {
      nodeName: this.nodeName,
      children: this.children.toJSON(),
      attributes: this.attributes.toJSON()
    }
  }

  /**
   * @return {XmlDelta<Children, Attrs, ChildModifiers, AttrModifiers, 'done'>}
   */
  done () {
    this.children.done()
    this.attributes.done()
    return /** @type {any} */ (this)
  }

  /**
   * @param {XmlDelta<any,any,any>} other
   */
  [traits.EqualityTraitSymbol] (other) {
    return this.nodeName === other.nodeName && this.children[traits.EqualityTraitSymbol](other.children) && this.attributes[traits.EqualityTraitSymbol](other.attributes)
  }
}

/**
 * @template {string|undefined} NodeName
 * @template Children
 * @template {object} Attrs
 * @template {Delta|undefined} [ChildModifiers=undefined]
 * @template {Delta|undefined} [AttrModifiers=undefined]
 * @param {NodeName} nodeName
 * @param {ArrayDeltaBuilder<Children,ChildModifiers>} children
 * @param {MapDeltaBuilder<Attrs,AttrModifiers>} attributes
 * @return {XmlDelta<NodeName,Children,Attrs,ChildModifiers, AttrModifiers>}
 */
export const createXmlDelta = (nodeName, children = createArrayDelta(), attributes = /** @type {any} */ (createMapDelta())) => new XmlDelta(nodeName, children, attributes)

/**
 * @template {object} Vals
 * @template {Delta|undefined} [Modifiers=undefined]
 * @extends MapDelta<Vals,Modifiers>
 */
export class MapDeltaBuilder extends MapDelta {
  /**
   * @template {keyof Vals} K
   * @param {K} key
   * @param {Modifiers} delta
   */
  modify (key, delta) {
    this.changes.set(key, /** @type {any} */ ({ type: 'modify', delta }))
    return this
  }

  /**
   * @template {keyof Vals} K
   * @param {K} key
   * @param {Vals[K]} newVal
   * @param {Vals[K]|undefined} prevValue
   * @param {Attribution_?} attribution
   */
  set (key, newVal, prevValue = undefined, attribution = null) {
    const mergedAttribution = mergeAttrs(this.usedAttribution, attribution)
    this.changes.set(key, new MapInsertOp(newVal, prevValue, mergedAttribution))
    return this
  }

  /**
   * @template {keyof Vals} K
   * @param {K} key
   * @param {Vals[K]|undefined} prevValue
   * @param {Attribution_?} attribution
   */
  delete (key, prevValue = undefined, attribution = null) {
    const mergedAttribution = mergeAttrs(this.usedAttribution, attribution)
    this.changes.set(key, new MapDeleteOp(prevValue, mergedAttribution))
    return this
  }

  /**
   * @param {Attribution_?} attribution
   */
  useAttribution (attribution) {
    this.usedAttribution = attribution
    return this
  }
}

export const createMapDelta = () => new MapDeltaBuilder()

/**
 * Helper function to merge attribution and attributes. The latter input "wins".
 *
 * @template {{ [key: string]: any }} T
 * @param {T | null} a
 * @param {T | null} b
 */
const mergeAttrs = (a, b) => object.isEmpty(a) ? b : (object.isEmpty(b) ? a : object.assign({}, a, b))

/**
 * @template {'array' | 'text' | 'custom'} Type
 * @template {DeltaOp<any,any,Modifiers>} TDeltaOp
 * @template {Delta|undefined} Modifiers
 * @extends AbstractArrayDelta<Type,TDeltaOp,Modifiers>
 */
export class AbstractArrayDeltaBuilder extends AbstractArrayDelta {
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
     * @type {Attribution_?}
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
    this.usedAttributes = attributes
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
   * @template {keyof Attribution_} NAME
   * @param {NAME} name
   * @param {Attribution_[NAME]?} value
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
   * @param {Attribution_?} attribution
   */
  useAttribution (attribution) {
    this.usedAttribution = attribution
    return this
  }

  /**
   * @param {(TDeltaOp extends InsertStringOp ? string : never) | (TDeltaOp extends InsertEmbedOp<infer Embeds> ? (Embeds) : never) | (TDeltaOp extends InsertArrayOp<infer Content> ? Array<Content> : never) } insert
   * @param {FormattingAttributes?} attributes
   * @param {Attribution_?} attribution
   * @return {this}
   */
  insert (insert, attributes = null, attribution = null) {
    const mergedAttributes = mergeAttrs(this.usedAttributes, attributes)
    const mergedAttribution = mergeAttrs(this.usedAttribution, attribution)
    if (((this.lastOp instanceof InsertStringOp && insert.constructor === String) || (this.lastOp instanceof InsertArrayOp && insert.constructor === Array)) && (mergedAttributes === this.lastOp.attributes || fun.equalityDeep(mergedAttributes, this.lastOp.attributes)) && (mergedAttribution === this.lastOp.attribution || fun.equalityDeep(mergedAttribution, this.lastOp.attribution))) {
      // @ts-ignore
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
   * @param {Attribution_?} attribution
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
   * @return {Type extends 'array' ? ArrayDelta<TDeltaOp,Modifiers> : (Type extends 'text' ? TextDelta<TDeltaOp,Modifiers> : AbstractArrayDelta<Type,TDeltaOp,Modifiers>)}
   */
  done () {
    while (this.lastOp != null && this.lastOp instanceof RetainOp && this.lastOp.attributes === null && this.lastOp.attribution === null) {
      this.ops.pop()
      this.lastOp = this.ops[this.ops.length - 1] ?? null
    }
    return /** @type {any} */ (this)
  }
}

/**
 * @template {any} ArrayContent
 * @template {Delta|undefined} Modifiers
 * @extends AbstractArrayDeltaBuilder<'array', ArrayDeltaOp<ArrayContent>,Modifiers>
 */
export class ArrayDeltaBuilder extends AbstractArrayDeltaBuilder {
  constructor () {
    super('array')
  }
}

/**
 * @template {any} ArrayContent
 * @template {Delta|undefined} Modifiers
 * @typedef {AbstractArrayDelta<'array', ArrayDeltaOp<ArrayContent>,Modifiers>} ArrayDelta
 */

/**
 * @template {object} Embeds
 * @template {Delta|undefined} Modifiers
 * @typedef {AbstractArrayDelta<'text',TextDeltaOp<Embeds,Modifiers>,Modifiers>} TextDelta
 */

/**
 * @template {object} Embeds
 * @template {Delta|undefined} [Modifiers=undefined]
 * @extends AbstractArrayDeltaBuilder<'text',TextDeltaOp<Embeds,Modifiers>,Modifiers>
 */
export class TextDeltaBuilder extends AbstractArrayDeltaBuilder {
  constructor () {
    super('text')
  }
}

/**
 * @template {object} [Embeds=any]
 * @template {Delta|undefined} [Modifiers=undefined]
 * @return {TextDeltaBuilder<Embeds,Modifiers>}
 */
export const createTextDelta = () => new TextDeltaBuilder()

/**
 * @template [V=any]
 * @template {Delta|undefined} [Modifiers=undefined]
 * @return {ArrayDeltaBuilder<V,Modifiers>}
 */
export const createArrayDelta = () => new ArrayDeltaBuilder()

/**
 * @template {'custom' | 'text' | 'array'} T
 * @param {DeltaJson} ops
 * @param {T} type
 */
export const fromJSON = (ops, type) => {
  const d = new AbstractArrayDeltaBuilder(type)
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
