
import {
  isDeleted,
  createDeleteSetFromStructStore,
  getStateVector,
  getItem,
  getItemCleanStart,
  iterateDeletedStructs,
  writeDeleteSet,
  writeStateVector,
  readDeleteSet,
  readStateVector,
  createDeleteSet,
  createID,
  ID,
  getState,
  findIndexCleanStart,
  AbstractStruct,
  applyDeleteItem,
  AbstractDSDecoder, AbstractDSEncoder, DSEncoderV1, DSEncoderV2, DSDecoderV1, DSDecoderV2, Transaction, Doc, DeleteSet, Item // eslint-disable-line
} from '../internals.js'

import * as map from 'lib0/map.js'
import * as set from 'lib0/set.js'
import * as decoding from 'lib0/decoding.js'
import { DefaultDSEncoder } from './encoding.js'

export class Snapshot {
  /**
   * @param {DeleteSet} ds
   * @param {Map<number,number>} sv state map
   */
  constructor (ds, sv) {
    /**
     * @type {DeleteSet}
     */
    this.ds = ds
    /**
     * State Map
     * @type {Map<number,number>}
     */
    this.sv = sv
  }
}

/**
 * @param {Snapshot} snap1
 * @param {Snapshot} snap2
 * @return {boolean}
 */
export const equalSnapshots = (snap1, snap2) => {
  const ds1 = snap1.ds.clients
  const ds2 = snap2.ds.clients
  const sv1 = snap1.sv
  const sv2 = snap2.sv
  if (sv1.size !== sv2.size || ds1.size !== ds2.size) {
    return false
  }
  for (const [key, value] of sv1.entries()) {
    if (sv2.get(key) !== value) {
      return false
    }
  }
  for (const [client, dsitems1] of ds1.entries()) {
    const dsitems2 = ds2.get(client) || []
    if (dsitems1.length !== dsitems2.length) {
      return false
    }
    for (let i = 0; i < dsitems1.length; i++) {
      const dsitem1 = dsitems1[i]
      const dsitem2 = dsitems2[i]
      if (dsitem1.clock !== dsitem2.clock || dsitem1.len !== dsitem2.len) {
        return false
      }
    }
  }
  return true
}

/**
 * @param {Snapshot} snapshot
 * @param {AbstractDSEncoder} [encoder]
 * @return {Uint8Array}
 */
export const encodeSnapshotV2 = (snapshot, encoder = new DSEncoderV2()) => {
  writeDeleteSet(encoder, snapshot.ds)
  writeStateVector(encoder, snapshot.sv)
  return encoder.toUint8Array()
}

/**
 * @param {Snapshot} snapshot
 * @return {Uint8Array}
 */
export const encodeSnapshot = snapshot => encodeSnapshotV2(snapshot, new DefaultDSEncoder())

/**
 * @param {Uint8Array} buf
 * @param {AbstractDSDecoder} [decoder]
 * @return {Snapshot}
 */
export const decodeSnapshotV2 = (buf, decoder = new DSDecoderV2(decoding.createDecoder(buf))) => {
  return new Snapshot(readDeleteSet(decoder), readStateVector(decoder))
}

/**
 * @param {Uint8Array} buf
 * @return {Snapshot}
 */
export const decodeSnapshot = buf => decodeSnapshotV2(buf, new DSDecoderV1(decoding.createDecoder(buf)))

/**
 * @param {DeleteSet} ds
 * @param {Map<number,number>} sm
 * @return {Snapshot}
 */
export const createSnapshot = (ds, sm) => new Snapshot(ds, sm)

export const emptySnapshot = createSnapshot(createDeleteSet(), new Map())

/**
 * @param {Doc} doc
 * @return {Snapshot}
 */
export const snapshot = doc => createSnapshot(createDeleteSetFromStructStore(doc.store), getStateVector(doc.store))

/**
 * @param {Item} item
 * @param {Snapshot|undefined} snapshot
 *
 * @protected
 * @function
 */
export const isVisible = (item, snapshot) => snapshot === undefined ? !item.deleted : (
  snapshot.sv.has(item.id.client) && (snapshot.sv.get(item.id.client) || 0) > item.id.clock && !isDeleted(snapshot.ds, item.id)
)

/**
 * @param {Transaction} transaction
 * @param {Snapshot} snapshot
 */
export const splitSnapshotAffectedStructs = (transaction, snapshot) => {
  const meta = map.setIfUndefined(transaction.meta, splitSnapshotAffectedStructs, set.create)
  const store = transaction.doc.store
  // check if we already split for this snapshot
  if (!meta.has(snapshot)) {
    snapshot.sv.forEach((clock, client) => {
      if (clock < getState(store, client)) {
        getItemCleanStart(transaction, createID(client, clock))
      }
    })
    iterateDeletedStructs(transaction, snapshot.ds, item => {})
    meta.add(snapshot)
  }
}

/**
 * @param {Doc} originDoc
 * @param {Snapshot} snapshot
 * @return {Doc}
 */
export const createDocFromSnapshot = (originDoc, snapshot) => {
  if (originDoc.gc) {
    // we should not try to restore a GC-ed document, because some of the restored items might have their content deleted
    throw new Error('originDoc must not be garbage collected')
  }
  const { sv, ds } = snapshot
  const needState = new Map(sv)

  let len = 0
  const tempStructs = []
  /**
   * State Map
   * @type any[]
   */
  const itemsToIntegrate = []
  originDoc.transact(transaction => {
    for (let user of needState.keys()) {
      let clock = needState.get(user) || 0
      const userItems = originDoc.store.clients.get(user)
      if (!userItems) {
        continue
      }

      let lastIndex
      const lastItem = userItems[userItems.length - 1]
      if (clock === lastItem.id.clock + lastItem.length) {
        lastIndex = lastItem.id.clock + lastItem.length + 1
      } else {
        lastIndex = findIndexCleanStart(transaction, userItems, clock)
      }
      for (let i = 0; i < lastIndex; i++) {
        const item = userItems[i]
        if (item instanceof Item) {
          itemsToIntegrate.push({
            id: item.id,
            left: item.left ? item.left.id : null,
            right: item.right ? item.right.id : null,
            origin: item.origin ? createID(item.origin.client, item.origin.clock) : null,
            rightOrigin: item.rightOrigin ? createID(item.rightOrigin.client, item.rightOrigin.clock) : null,
            parent: item.parent,
            parentSub: item.parentSub,
            content: item.content.copy()
          })
        }
      }
    }
  })

  const newDoc = new Doc()

  // copy root types
  const sharedKeysByValue = new Map()
  for (const [key, t] of originDoc.share) {
    const Constructor = t.constructor
    newDoc.get(key, Constructor)
    sharedKeysByValue.set(t, key)
  }

  let lastId = new Map()
  /**
   * @param {ID} id
   * @return {Item|null}
   */
  const getItemSafe = (id) => {
    if (!lastId.has(id.client)) {
      return null
    }
    if (lastId.get(id.client) < id.clock) {
      return null
    }
    return getItem(newDoc.store, id)
  }
  newDoc.transact(transaction => {
    for (const item of itemsToIntegrate) {
      let parent = null
      let left = null
      let right = null
      const sharedKey = sharedKeysByValue.get(item.parent)
      if (sharedKey) {
        parent = newDoc.get(sharedKey)
      } else if (item.parent) {
        parent = getItem(newDoc.store, item.parent._item.id).content.type
      }
      if (item.left) {
        left = getItemSafe(item.left)
      }
      if (item.right) {
        right = getItemSafe(item.right)
      }
      lastId.set(item.id.client, item.id.clock)
      const newItem = new Item(
        item.id,
        left,
        item.origin,
        right,
        item.rightOrigin,
        parent, // not sure
        item.parentSub,
        item.content
      )
      newItem.integrate(transaction, 0)
    }

    for (const [client, deleteItems] of ds.clients) {
      for (const deleteItem of deleteItems) {
        const items = newDoc.store.clients.get(client)
        if (items) {
          applyDeleteItem(transaction, items, deleteItem)
        }
      }
    }
  })

  return newDoc
}