import { AbstractType, Item, Transaction, UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2, StructStore, YArray, Doc, YMap, ID } from '../internals.js' // eslint-disable-line
import * as error from 'lib0/error'

/**
 * @typedef {Object} ContentDocUnrefOpts
 * @property {string} guid target doc guid
 * @property {ID} id ID of the ref item
 */

/**
 * @typedef {Object} ContentDocRefOpts
 * @property {string} guid
 */

export class ContentDocRef {
  /**
   * @param {AbstractType<any> | ContentDocRefOpts} opt
   */
  constructor (opt) {
    /**
     * Target doc guid
     * @type {string}
     */
    this.guid = ''

    /** @type {Item & { content: ContentDocRef } | null} */
    this._item = null

    /** @type {import('../types/AbstractType.js').AbstractType<any> | null} */
    this._type = null

    // ContentDocRef の初期化は以下の2パターン
    // - type から作る: Map/Array に直接 type を set/insert するとき
    // - guid から作る: Decoder から読み込むとき
    if (opt instanceof AbstractType) {
      this._type = opt
    } else {
      this.guid = opt.guid
    }
  }

  /**
   * @param {Transaction} transaction
   * @param {Item & { content: ContentDocRef }} item
   */
  integrate (transaction, item) {
    this._item = item
    const rootDoc = /** @type {AbstractType<any>} */ (item.parent).doc?.rootDoc
    const rt = transaction.rootTransaction
    if (!rootDoc || !rt) return
    rt.docRefsAdded.add(this)

    // ref の conflict や循環参照が見つかった場合
    // tr.local なら、この場で解決する.
    // tr.local でないなら、ここでは解決せずに、cleanup の中で解決する（つまり次の local な transaction).

    // transaction.local の場合は、this._type が存在する
    if (transaction.local) {
      // guid から作成の場合、doc を取得または作成する
      // if (this.guid) {
      //   let doc = rootDoc.getRefDoc(this.guid)
      //   if (!doc) {
      //     // TODO: option をいくつか引き継ぐべき
      //     doc = new Doc({ guid: this.guid, gc: rootDoc.gc })
      //   }
      //   if (doc._referrer) {
      //     // この item を削除して、ref の競合を解決する
      //     resolveRefConflict(rootDoc, this)
      //   } else {
      //     doc._referrer = item
      //   }
      // } else
      if (this._type) {
        // type から作成の場合、doc はまだ存在しないので、新規作成する
        // TODO: option をいくつか引き継ぐべき
        const newDoc = new Doc({
          gc: rootDoc.gc,
          clientID: rootDoc.clientID,
          autoRef: rootDoc.autoRef,
        })
        rootDoc.addRefDoc(newDoc)
        this.guid = newDoc.guid
        this._type._integrate(newDoc, null)
        newDoc.share.set('', this._type)
        newDoc._referrer = item
        validateCircularRef(item)
      } else {
        throw error.unexpectedCase()
      }
    } else {
      // transaction.local ではない場合、guid が存在する
      if (this.guid) {
        let doc = rootDoc.getRefDoc(this.guid)
        if (!doc) {
          // TODO: option をいくつか引き継ぐべき
          doc = new Doc({
            guid: this.guid,
            gc: rootDoc.gc,
            clientID: rootDoc.clientID,
            autoRef: rootDoc.autoRef,
          })
          rootDoc.addRefDoc(doc)
          // referrer の設定などは transaction の最後で行われる
          // なぜなら非 local な transaction 内で新しい transaction を作成する可能性があるため
        }
      } else {
        throw error.unexpectedCase()
      }
    }
  }

  /**
   * @return {import('../utils/Doc.js').Doc}
   */
  getDoc () {
    if (!this._item || !this.guid) {
      throw new Error('ContentDocRef is not integrated yet')
    }
    const parentDoc = /** @type {AbstractType<any>} */ (this._item.parent).doc
    const rootDoc = parentDoc?.rootDoc
    if (!rootDoc) {
      throw new Error('Parent doc is not attached to a root doc')
    }
    const doc = rootDoc.getRefDoc(this.guid)
    if (!doc) {
      throw new Error('Referenced doc not found')
    }
    return doc
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
    if (this._type !== null) return [this._type]
    return [this.guid]
  }

  /**
   * @return {number}
   */
  getRef () {
    return 11
  }

  /**
   * @return {boolean}
   */
  isCountable () {
    return true
  }

  copy () {
    return new ContentDocRef({ guid: this.guid })
  }

  /**
   * @param {number} offset
   */
  splice (offset) {
    if (offset !== 0) {
      throw error.methodUnimplemented()
    }
    return this
  }

  /**
   * @param {Transaction} transaction
   */
  delete (transaction) {
    const doc = this.getDoc()
    doc._referrer = null
    if (transaction.rootTransaction) {
      const rt = transaction.rootTransaction
      if (rt.docRefsAdded.has(this)) {
        rt.docRefsAdded.delete(this)
      } else {
        rt.docRefsRemoved.add(this)
      }
    }
    if (transaction.local && doc) {
      addUnrefToDoc(doc, this)
    }
  }

  /**
   * @param {StructStore} _store
   */
  gc (_store) { }

  mergeWith () {
    return false
  }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    if (offset > 0) {
      throw error.methodUnimplemented()
    }
    encoder.writeString(this.guid)
  }
}

export class ContentDocUnref {
  /**
   * @param {ContentDocUnrefOpts} opt
   */
  constructor (opt) {
    this.guid = opt.guid
    this.id = opt.id
  }

  integrate () { }

  getLength () {
    return 1
  }

  /**
   * @return {Array<any>}
   */
  getContent () {
    return [this.guid]
  }

  /**
   * @return {number}
   */
  getRef () {
    return 12
  }

  isCountable () {
    return true
  }

  copy () {
    return new ContentDocUnref({ guid: this.guid, id: this.id })
  }

  /**
   * @param {number} _offset
   */
  splice (_offset) {
    if (_offset !== 0) {
      throw error.methodUnimplemented()
    }
    return this
  }

  mergeWith () {
    return false
  }

  /**
   * @param {Transaction} _transaction
   */
  delete (_transaction) { }

  /**
   * @param {StructStore} _store
   */
  gc (_store) { }

  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {number} offset
   */
  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   * @param {number} offset
   */
  write (encoder, offset) {
    encoder.writeString(this.guid)
    encoder.writeLeftID(this.id)
  }
}

/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
 */
export const readContentDocRef = (decoder) => {
  const guid = decoder.readString()
  return new ContentDocRef({ guid })
}

/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
 */
export const readContentDocUnref = (decoder) => {
  const guid = decoder.readString()
  const id = decoder.readLeftID()
  return new ContentDocUnref({ guid, id })
}

/**
 * @param {import('../utils/Doc.js').Doc} doc
 * @param {ContentDocRef} ref
 */
function addUnrefToDoc (doc, ref) {
  if (!ref._item) return
  const unrefs = doc.get('_unrefs', YArray)
  const unref = new ContentDocUnref({
    guid: ref.guid,
    id: ref._item.id
  })
  unrefs.push([unref])
}

/**
 * @param {import('../utils/Doc.js').Doc} rootDoc
 * @param {ContentDocRef} ref The ref conflicted
 */
export function resolveRefConflict (rootDoc, ref) {
  const refItem = ref._item
  if (!refItem || refItem.deleted) return
  if (refItem.parentSub) {
    const key = refItem.parentSub
    const map = /** @type {YMap<any>} */ (refItem.parent)
    map.delete(key)
    const cloned = cloneDoc(rootDoc, ref)
    map.set(key, cloned)
  } else {
    const array = /** @type {import('../types/YArray.js').YArray<any>} */ (refItem.parent)
    /** @type {Item | null} */
    let n = refItem.left
    let index = 0
    while (n !== null) {
      if (!n.deleted && n.countable) {
        index += n.length
      }
      n = n.left
    }
    array.delete(index)
    const cloned = cloneDoc(rootDoc, ref)
    array.insert(index, [cloned])
  }
}

/**
 * @param {import('../utils/Doc.js').Doc} rootDoc
 * @param {ContentDocRef} ref
 * @return {AbstractType<any>}
 */
function cloneDoc (rootDoc, ref) {
  const sourceDoc = ref.getDoc()
  const type = /** @type {AbstractType<any>} | undefined */ (sourceDoc.share.get('root'))
  if (!type) throw new Error('root type not found on referenced doc')
  if (type instanceof YArray) {
    const newType = new YArray()
    newType.createRef = true
    let item = type._start
    while (item) {
      if (item.countable && !item.deleted) {
        if (item.content instanceof ContentDocRef) {
          const nested = cloneDoc(rootDoc, item.content)
          newType.push([nested])
        } else {
          newType.push(item.content.getContent().map(c => {
            if (c instanceof AbstractType) {
              const cloned = c.clone()
              cloned.createRef = false
              return cloned
            }
            return c
          }))
        }
      }
      item = item.right
    }
    return newType
  } else if (type instanceof YMap) {
    const newType = new YMap()
    newType.createRef = true
    type._map.forEach((itm, key) => {
      if (itm.countable && !itm.deleted) {
        if (itm.content instanceof ContentDocRef) {
          const nested = cloneDoc(rootDoc, itm.content)
          newType.set(key, nested)
        } else {
          const c = itm.content.getContent()
          const val = c[c.length - 1]
          if (val instanceof AbstractType) {
            const cloned = val.clone()
            cloned.createRef = false
            newType.set(key, cloned)
          } else {
            newType.set(key, val)
          }
        }
      }
    })
    return newType
  } else {
    const cloned = type.clone()
    cloned.createRef = true
    return cloned
  }
}

/**
 * @private
 * @param {Item & { content: ContentDocRef }} item
 */
export function validateCircularRef (item) {
  if (item?.deleted) return
  const targetGuid = item.content.guid
  let cursor = /** @type {Item | null} */ (item)
  while (cursor && cursor.parent && /** @type {any} */ (cursor.parent).doc) {
    const d = /** @type {any} */ (cursor.parent).doc
    if (d.guid === targetGuid) {
      // circular detected: remove the ref placement
      if (item.parentSub) {
        const map = /** @type {YMap<any>} */ (item.parent)
        map.delete(item.parentSub)
      } else {
        const array = /** @type {import('../types/YArray.js').YArray<any>} */ (item.parent)
        const index = findIndexInArray(item)
        array.delete(index)
      }
      return
    }
    cursor = d._referrer
  }
}

/**
 * @param {Item} item
 */
function findIndexInArray (item) {
  let index = 0
  let n = item.left
  while (n) {
    if (!n.deleted && n.countable) {
      index += n.length
    }
    n = n.left
  }
  return index
}
