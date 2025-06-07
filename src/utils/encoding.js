/**
 * @module encoding
 */
/*
 * We use the first five bits in the info flag for determining the type of the struct.
 *
 * 0: GC
 * 1: Item with Deleted content
 * 2: Item with JSON content
 * 3: Item with Binary content
 * 4: Item with String content
 * 5: Item with Embed content (for richtext content)
 * 6: Item with Format content (a formatting marker for richtext content)
 * 7: Item with Type
 */

import {
  findIndexSS,
  getState,
  getStateVector,
  readAndApplyDeleteSet,
  writeIdSet,
  transact,
  UpdateDecoderV1,
  UpdateDecoderV2,
  UpdateEncoderV1,
  UpdateEncoderV2,
  IdSetEncoderV2,
  DSDecoderV1,
  IdSetEncoderV1,
  mergeUpdates,
  mergeUpdatesV2,
  Skip,
  diffUpdateV2,
  convertUpdateFormatV2ToV1,
  readStructSet,
  removeRangesFromStructSet,
  createIdSet,
  StructSet, IdSet, DSDecoderV2, Doc, Transaction, GC, Item, StructStore, // eslint-disable-line
  createID,
  IdRange
} from '../internals.js'

import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'
import * as map from 'lib0/map'
import * as math from 'lib0/math'
import * as array from 'lib0/array'

/**
 * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
 * @param {Array<GC|Item>} structs All structs by `client`
 * @param {number} client
 * @param {Array<IdRange>} idranges
 *
 * @function
 */
const writeStructs = (encoder, structs, client, idranges) => {
  let structsToWrite = 0 // this accounts for the skips
  /**
   * @type {Array<{ start: number, end: number, startClock: number, endClock: number }>}
   */
  const indexRanges = []
  const firstPossibleClock = structs[0].id.clock
  const lastStruct = array.last(structs)
  const lastPossibleClock = lastStruct.id.clock + lastStruct.length
  idranges.forEach(idrange => {
    const startClock = math.max(idrange.clock, firstPossibleClock)
    const endClock = math.min(idrange.clock + idrange.len, lastPossibleClock)
    if (startClock >= endClock) return // structs for this range do not exist
    // inclusive start
    const start = findIndexSS(structs, startClock)
    // exclusive end
    const end = findIndexSS(structs, endClock - 1) + 1
    structsToWrite += end - start
    indexRanges.push({
      start,
      end,
      startClock,
      endClock
    })
  })
  structsToWrite += idranges.length - 1
  // start writing with this clock. this is updated to the next clock that we expect to write
  let clock = indexRanges[0].startClock
  // write # encoded structs
  encoding.writeVarUint(encoder.restEncoder, structsToWrite)
  encoder.writeClient(client)
  // write clock
  encoding.writeVarUint(encoder.restEncoder, clock)
  indexRanges.forEach(indexRange => {
    const skipLen = indexRange.startClock - clock
    if (skipLen > 0) {
      new Skip(createID(client, clock), skipLen).write(encoder, 0)
      clock += skipLen
    }
    for (let i = indexRange.start; i < indexRange.end; i++) {
      const struct = structs[i]
      const structEnd = struct.id.clock + struct.length
      const offsetEnd = math.max(structEnd - indexRange.endClock, 0)
      struct.write(encoder, clock - struct.id.clock, offsetEnd)
      clock = structEnd - offsetEnd
    }
  })
}

/**
 * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
 * @param {StructStore} store
 * @param {Map<number,number>} _sm
 *
 * @private
 * @function
 */
export const writeClientsStructs = (encoder, store, _sm) => {
  // we filter all valid _sm entries into sm
  const sm = new Map()
  _sm.forEach((clock, client) => {
    // only write if new structs are available
    if (getState(store, client) > clock) {
      sm.set(client, clock)
    }
  })
  getStateVector(store).forEach((_clock, client) => {
    if (!_sm.has(client)) {
      sm.set(client, 0)
    }
  })
  // write # states that were updated
  encoding.writeVarUint(encoder.restEncoder, sm.size)
  // Write items with higher client ids first
  // This heavily improves the conflict algorithm.
  array.from(sm.entries()).sort((a, b) => b[0] - a[0]).forEach(([client, clock]) => {
    const structs = /** @type {Array<GC|Item>} */ (store.clients.get(client))
    const lastStruct = structs[structs.length - 1]
    writeStructs(encoder, structs, client, [new IdRange(clock, lastStruct.id.clock + lastStruct.length - clock)])
  })
}

/**
 * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
 * @param {StructStore} store
 * @param {IdSet} idset
 *
 * @todo at the moment this writes the full deleteset range
 *
 * @private
 * @function
 */
export const writeStructsFromIdSet = (encoder, store, idset) => {
  // write # states that were updated
  encoding.writeVarUint(encoder.restEncoder, idset.clients.size)
  // Write items with higher client ids first
  // This heavily improves the conflict algorithm.
  array.from(idset.clients.entries()).sort((a, b) => b[0] - a[0]).forEach(([client, ids]) => {
    const idRanges = ids.getIds()
    const structs = /** @type {Array<GC|Item>} */ (store.clients.get(client))
    writeStructs(encoder, structs, client, idRanges)
  })
}

/**
 * Resume computing structs generated by struct readers.
 *
 * While there is something to do, we integrate structs in this order
 * 1. top element on stack, if stack is not empty
 * 2. next element from current struct reader (if empty, use next struct reader)
 *
 * If struct causally depends on another struct (ref.missing), we put next reader of
 * `ref.id.client` on top of stack.
 *
 * At some point we find a struct that has no causal dependencies,
 * then we start emptying the stack.
 *
 * It is not possible to have circles: i.e. struct1 (from client1) depends on struct2 (from client2)
 * depends on struct3 (from client1). Therefore the max stack size is equal to `structReaders.length`.
 *
 * This method is implemented in a way so that we can resume computation if this update
 * causally depends on another update.
 *
 * @param {Transaction} transaction
 * @param {StructStore} store
 * @param {StructSet} clientsStructRefs
 * @return { null | { update: Uint8Array, missing: Map<number,number> } }
 *
 * @private
 * @function
 */
const integrateStructs = (transaction, store, clientsStructRefs) => {
  /**
   * @type {Array<Item | GC>}
   */
  const stack = []
  // sort them so that we take the higher id first, in case of conflicts the lower id will probably not conflict with the id from the higher user.
  let clientsStructRefsIds = array.from(clientsStructRefs.clients.keys()).sort((a, b) => a - b)
  if (clientsStructRefsIds.length === 0) {
    return null
  }
  const getNextStructTarget = () => {
    if (clientsStructRefsIds.length === 0) {
      return null
    }
    let nextStructsTarget = /** @type {{i:number,refs:Array<GC|Item>}} */ (clientsStructRefs.clients.get(clientsStructRefsIds[clientsStructRefsIds.length - 1]))
    while (nextStructsTarget.refs.length === nextStructsTarget.i) {
      clientsStructRefsIds.pop()
      if (clientsStructRefsIds.length > 0) {
        nextStructsTarget = /** @type {{i:number,refs:Array<GC|Item>}} */ (clientsStructRefs.clients.get(clientsStructRefsIds[clientsStructRefsIds.length - 1]))
      } else {
        return null
      }
    }
    return nextStructsTarget
  }
  let curStructsTarget = getNextStructTarget()
  if (curStructsTarget === null) {
    return null
  }

  /**
   * @type {StructStore}
   */
  const restStructs = new StructStore()
  const missingSV = new Map()
  /**
   * @param {number} client
   * @param {number} clock
   */
  const updateMissingSv = (client, clock) => {
    const mclock = missingSV.get(client)
    if (mclock == null || mclock > clock) {
      missingSV.set(client, clock)
    }
  }
  /**
   * @type {GC|Item}
   */
  let stackHead = /** @type {any} */ (curStructsTarget).refs[/** @type {any} */ (curStructsTarget).i++]
  // caching the state because it is used very often
  const state = new Map()

  // // caching the state because it is used very often
  // const currentInsertSet = createIdSet()
  // clientsStructRefsIds.forEach(clientId => {
  //   currentInsertSet.clients.set(clientid, new IdRanges(_createInsertSliceFromStructs(store.clients.get(clientId) ?? [], false)))
  // })

  const addStackToRestSS = () => {
    for (const item of stack) {
      const client = item.id.client
      const inapplicableItems = clientsStructRefs.clients.get(client)
      if (inapplicableItems) {
        // decrement because we weren't able to apply previous operation
        inapplicableItems.i--
        restStructs.clients.set(client, inapplicableItems.refs.slice(inapplicableItems.i))
        clientsStructRefs.clients.delete(client)
        inapplicableItems.i = 0
        inapplicableItems.refs = []
      } else {
        // item was the last item on clientsStructRefs and the field was already cleared. Add item to restStructs and continue
        restStructs.clients.set(client, [item])
      }
      // remove client from clientsStructRefsIds to prevent users from applying the same update again
      clientsStructRefsIds = clientsStructRefsIds.filter(c => c !== client)
    }
    stack.length = 0
  }

  // iterate over all struct readers until we are done
  while (true) {
    if (stackHead.constructor !== Skip) {
      const localClock = map.setIfUndefined(state, stackHead.id.client, () => getState(store, stackHead.id.client))
      const offset = localClock - stackHead.id.clock
      const missing = stackHead.getMissing(transaction, store)
      if (missing !== null) {
        stack.push(stackHead)
        // get the struct reader that has the missing struct
        /**
         * @type {{ refs: Array<GC|Item>, i: number }}
         */
        const structRefs = clientsStructRefs.clients.get(/** @type {number} */ (missing)) || { refs: [], i: 0 }
        if (structRefs.refs.length === structRefs.i || missing === stackHead.id.client || stack.some(s => s.id.client === missing)) { // @todo this could be optimized!
          // This update message causally depends on another update message that doesn't exist yet
          updateMissingSv(/** @type {number} */ (missing), getState(store, missing))
          addStackToRestSS()
        } else {
          stackHead = structRefs.refs[structRefs.i++]
          continue
        }
      } else {
        // all fine, apply the stackhead
        // but first add a skip to structs if necessary
        if (offset < 0) {
          const skip = new Skip(createID(stackHead.id.client, localClock), -offset)
          skip.integrate(transaction, 0)
        }
        stackHead.integrate(transaction, 0)
        state.set(stackHead.id.client, math.max(stackHead.id.clock + stackHead.length, localClock))
      }
    }
    // iterate to next stackHead
    if (stack.length > 0) {
      stackHead = /** @type {GC|Item} */ (stack.pop())
    } else if (curStructsTarget !== null && curStructsTarget.i < curStructsTarget.refs.length) {
      stackHead = /** @type {GC|Item} */ (curStructsTarget.refs[curStructsTarget.i++])
    } else {
      curStructsTarget = getNextStructTarget()
      if (curStructsTarget === null) {
        // we are done!
        break
      } else {
        stackHead = /** @type {GC|Item} */ (curStructsTarget.refs[curStructsTarget.i++])
      }
    }
  }
  if (restStructs.clients.size > 0) {
    const encoder = new UpdateEncoderV2()
    writeClientsStructs(encoder, restStructs, new Map())
    // write empty deleteset
    // writeDeleteSet(encoder, new DeleteSet())
    encoding.writeVarUint(encoder.restEncoder, 0) // => no need for an extra function call, just write 0 deletes
    return { missing: missingSV, update: encoder.toUint8Array() }
  }
  return null
}

/**
 * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
 * @param {Transaction} transaction
 *
 * @private
 * @function
 */
export const writeStructsFromTransaction = (encoder, transaction) => writeStructsFromIdSet(encoder, transaction.doc.store, transaction.insertSet)

/**
 * Read and apply a document update.
 *
 * This function has the same effect as `applyUpdate` but accepts a decoder.
 *
 * @param {decoding.Decoder} decoder
 * @param {Doc} ydoc
 * @param {any} [transactionOrigin] This will be stored on `transaction.origin` and `.on('update', (update, origin))`
 * @param {UpdateDecoderV1 | UpdateDecoderV2} [structDecoder]
 *
 * @function
 */
export const readUpdateV2 = (decoder, ydoc, transactionOrigin, structDecoder = new UpdateDecoderV2(decoder)) =>
  transact(ydoc, transaction => {
    // force that transaction.local is set to non-local
    transaction.local = false
    let retry = false
    const doc = transaction.doc
    const store = doc.store
    // let start = performance.now()
    const ss = readStructSet(structDecoder, doc)
    const knownState = createIdSet()
    ss.clients.forEach((_, client) => {
      const storeStructs = store.clients.get(client)
      if (storeStructs) {
        const last = storeStructs[storeStructs.length - 1]
        knownState.add(client, 0, last.id.clock + last.length)
        // remove known items from ss
        store.skips.clients.get(client)?.getIds().forEach(idrange => {
          knownState.delete(client, idrange.clock, idrange.len)
        })
      }
    })
    // remove known items from ss
    removeRangesFromStructSet(ss, knownState)
    // console.log('time to read structs: ', performance.now() - start) // @todo remove
    // start = performance.now()
    // console.log('time to merge: ', performance.now() - start) // @todo remove
    // start = performance.now()
    const restStructs = integrateStructs(transaction, store, ss)
    const pending = store.pendingStructs
    if (pending) {
      // check if we can apply something
      for (const [client, clock] of pending.missing) {
        if (ss.clients.has(client) || clock < getState(store, client)) {
          retry = true
          break
        }
      }
      if (restStructs) {
        // merge restStructs into store.pending
        for (const [client, clock] of restStructs.missing) {
          const mclock = pending.missing.get(client)
          if (mclock == null || mclock > clock) {
            pending.missing.set(client, clock)
          }
        }
        pending.update = mergeUpdatesV2([pending.update, restStructs.update])
      }
    } else {
      store.pendingStructs = restStructs
    }
    // console.log('time to integrate: ', performance.now() - start) // @todo remove
    // start = performance.now()
    const dsRest = readAndApplyDeleteSet(structDecoder, transaction, store)
    if (store.pendingDs) {
      // @todo we could make a lower-bound state-vector check as we do above
      const pendingDSUpdate = new UpdateDecoderV2(decoding.createDecoder(store.pendingDs))
      decoding.readVarUint(pendingDSUpdate.restDecoder) // read 0 structs, because we only encode deletes in pendingdsupdate
      const dsRest2 = readAndApplyDeleteSet(pendingDSUpdate, transaction, store)
      if (dsRest && dsRest2) {
        // case 1: ds1 != null && ds2 != null
        store.pendingDs = mergeUpdatesV2([dsRest, dsRest2])
      } else {
        // case 2: ds1 != null
        // case 3: ds2 != null
        // case 4: ds1 == null && ds2 == null
        store.pendingDs = dsRest || dsRest2
      }
    } else {
      // Either dsRest == null && pendingDs == null OR dsRest != null
      store.pendingDs = dsRest
    }
    // console.log('time to cleanup: ', performance.now() - start) // @todo remove
    // start = performance.now()

    // console.log('time to resume delete readers: ', performance.now() - start) // @todo remove
    // start = performance.now()
    if (retry) {
      const update = /** @type {{update: Uint8Array}} */ (store.pendingStructs).update
      store.pendingStructs = null
      applyUpdateV2(transaction.doc, update)
    }
  }, transactionOrigin, false)

/**
 * Read and apply a document update.
 *
 * This function has the same effect as `applyUpdate` but accepts a decoder.
 *
 * @param {decoding.Decoder} decoder
 * @param {Doc} ydoc
 * @param {any} [transactionOrigin] This will be stored on `transaction.origin` and `.on('update', (update, origin))`
 *
 * @function
 */
export const readUpdate = (decoder, ydoc, transactionOrigin) => readUpdateV2(decoder, ydoc, transactionOrigin, new UpdateDecoderV1(decoder))

/**
 * Apply a document update created by, for example, `y.on('update', update => ..)` or `update = encodeStateAsUpdate()`.
 *
 * This function has the same effect as `readUpdate` but accepts an Uint8Array instead of a Decoder.
 *
 * @param {Doc} ydoc
 * @param {Uint8Array} update
 * @param {any} [transactionOrigin] This will be stored on `transaction.origin` and `.on('update', (update, origin))`
 * @param {typeof UpdateDecoderV1 | typeof UpdateDecoderV2} [YDecoder]
 *
 * @function
 */
export const applyUpdateV2 = (ydoc, update, transactionOrigin, YDecoder = UpdateDecoderV2) => {
  const decoder = decoding.createDecoder(update)
  readUpdateV2(decoder, ydoc, transactionOrigin, new YDecoder(decoder))
}

/**
 * Apply a document update created by, for example, `y.on('update', update => ..)` or `update = encodeStateAsUpdate()`.
 *
 * This function has the same effect as `readUpdate` but accepts an Uint8Array instead of a Decoder.
 *
 * @param {Doc} ydoc
 * @param {Uint8Array} update
 * @param {any} [transactionOrigin] This will be stored on `transaction.origin` and `.on('update', (update, origin))`
 *
 * @function
 */
export const applyUpdate = (ydoc, update, transactionOrigin) => applyUpdateV2(ydoc, update, transactionOrigin, UpdateDecoderV1)

/**
 * Write all the document as a single update message. If you specify the state of the remote client (`targetStateVector`) it will
 * only write the operations that are missing.
 *
 * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
 * @param {Doc} doc
 * @param {Map<number,number>} [targetStateVector] The state of the target that receives the update. Leave empty to write all known structs
 *
 * @function
 */
export const writeStateAsUpdate = (encoder, doc, targetStateVector = new Map()) => {
  writeClientsStructs(encoder, doc.store, targetStateVector)
  writeIdSet(encoder, doc.store.ds)
}

/**
 * Write all the document as a single update message that can be applied on the remote document. If you specify the state of the remote client (`targetState`) it will
 * only write the operations that are missing.
 *
 * Use `writeStateAsUpdate` instead if you are working with lib0/encoding.js#Encoder
 *
 * @param {Doc} doc
 * @param {Uint8Array} [encodedTargetStateVector] The state of the target that receives the update. Leave empty to write all known structs
 * @param {UpdateEncoderV1 | UpdateEncoderV2} [encoder]
 * @return {Uint8Array}
 *
 * @function
 */
export const encodeStateAsUpdateV2 = (doc, encodedTargetStateVector = new Uint8Array([0]), encoder = new UpdateEncoderV2()) => {
  const targetStateVector = decodeStateVector(encodedTargetStateVector)
  writeStateAsUpdate(encoder, doc, targetStateVector)
  const updates = [encoder.toUint8Array()]
  // also add the pending updates (if there are any)
  if (doc.store.pendingDs) {
    updates.push(doc.store.pendingDs)
  }
  if (doc.store.pendingStructs) {
    updates.push(diffUpdateV2(doc.store.pendingStructs.update, encodedTargetStateVector))
  }
  if (updates.length > 1) {
    if (encoder.constructor === UpdateEncoderV1) {
      return mergeUpdates(updates.map((update, i) => i === 0 ? update : convertUpdateFormatV2ToV1(update)))
    } else if (encoder.constructor === UpdateEncoderV2) {
      return mergeUpdatesV2(updates)
    }
  }
  return updates[0]
}

/**
 * Write all the document as a single update message that can be applied on the remote document. If you specify the state of the remote client (`targetState`) it will
 * only write the operations that are missing.
 *
 * Use `writeStateAsUpdate` instead if you are working with lib0/encoding.js#Encoder
 *
 * @param {Doc} doc
 * @param {Uint8Array} [encodedTargetStateVector] The state of the target that receives the update. Leave empty to write all known structs
 * @return {Uint8Array}
 *
 * @function
 */
export const encodeStateAsUpdate = (doc, encodedTargetStateVector) => encodeStateAsUpdateV2(doc, encodedTargetStateVector, new UpdateEncoderV1())

/**
 * Read state vector from Decoder and return as Map
 *
 * @param {DSDecoderV1 | DSDecoderV2} decoder
 * @return {Map<number,number>} Maps `client` to the number next expected `clock` from that client.
 *
 * @function
 */
export const readStateVector = decoder => {
  const ss = new Map()
  const ssLength = decoding.readVarUint(decoder.restDecoder)
  for (let i = 0; i < ssLength; i++) {
    const client = decoding.readVarUint(decoder.restDecoder)
    const clock = decoding.readVarUint(decoder.restDecoder)
    ss.set(client, clock)
  }
  return ss
}

/**
 * Read decodedState and return State as Map.
 *
 * @param {Uint8Array} decodedState
 * @return {Map<number,number>} Maps `client` to the number next expected `clock` from that client.
 *
 * @function
 */
// export const decodeStateVectorV2 = decodedState => readStateVector(new DSDecoderV2(decoding.createDecoder(decodedState)))

/**
 * Read decodedState and return State as Map.
 *
 * @param {Uint8Array} decodedState
 * @return {Map<number,number>} Maps `client` to the number next expected `clock` from that client.
 *
 * @function
 */
export const decodeStateVector = decodedState => readStateVector(new DSDecoderV1(decoding.createDecoder(decodedState)))

/**
 * @param {IdSetEncoderV1 | IdSetEncoderV2} encoder
 * @param {Map<number,number>} sv
 * @function
 */
export const writeStateVector = (encoder, sv) => {
  encoding.writeVarUint(encoder.restEncoder, sv.size)
  array.from(sv.entries()).sort((a, b) => b[0] - a[0]).forEach(([client, clock]) => {
    encoding.writeVarUint(encoder.restEncoder, client) // @todo use a special client decoder that is based on mapping
    encoding.writeVarUint(encoder.restEncoder, clock)
  })
  return encoder
}

/**
 * @param {IdSetEncoderV1 | IdSetEncoderV2} encoder
 * @param {Doc} doc
 *
 * @function
 */
export const writeDocumentStateVector = (encoder, doc) => writeStateVector(encoder, getStateVector(doc.store))

/**
 * Encode State as Uint8Array.
 *
 * @param {Doc|Map<number,number>} doc
 * @param {IdSetEncoderV1 | IdSetEncoderV2} [encoder]
 * @return {Uint8Array}
 *
 * @function
 */
export const encodeStateVectorV2 = (doc, encoder = new IdSetEncoderV2()) => {
  if (doc instanceof Map) {
    writeStateVector(encoder, doc)
  } else {
    writeDocumentStateVector(encoder, doc)
  }
  return encoder.toUint8Array()
}

/**
 * Encode State as Uint8Array.
 *
 * @param {Doc|Map<number,number>} doc
 * @return {Uint8Array}
 *
 * @function
 */
export const encodeStateVector = doc => encodeStateVectorV2(doc, new IdSetEncoderV1())
