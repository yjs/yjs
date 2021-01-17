
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
  createID,
  getStateVector,
  readAndApplyDeleteSet,
  writeDeleteSet,
  createDeleteSetFromStructStore,
  transact,
  readItemContent,
  UpdateDecoderV1,
  UpdateDecoderV2,
  UpdateEncoderV1,
  UpdateEncoderV2,
  DSDecoderV2,
  DSEncoderV2,
  DSDecoderV1,
  DSEncoderV1,
  mergeUpdates,
  Doc, Transaction, GC, Item, StructStore, ID // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import * as binary from 'lib0/binary.js'
import * as map from 'lib0/map.js'
import { mergeUpdatesV2 } from './updates.js'

/**
 * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
 * @param {Array<GC|Item>} structs All structs by `client`
 * @param {number} client
 * @param {number} clock write structs starting with `ID(client,clock)`
 *
 * @function
 */
const writeStructs = (encoder, structs, client, clock) => {
  // write first id
  const startNewStructs = findIndexSS(structs, clock)
  // write # encoded structs
  encoding.writeVarUint(encoder.restEncoder, structs.length - startNewStructs)
  encoder.writeClient(client)
  encoding.writeVarUint(encoder.restEncoder, clock)
  const firstStruct = structs[startNewStructs]
  // write first struct with an offset
  firstStruct.write(encoder, clock - firstStruct.id.clock)
  for (let i = startNewStructs + 1; i < structs.length; i++) {
    structs[i].write(encoder, 0)
  }
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
  getStateVector(store).forEach((clock, client) => {
    if (!_sm.has(client)) {
      sm.set(client, 0)
    }
  })
  // write # states that were updated
  encoding.writeVarUint(encoder.restEncoder, sm.size)
  // Write items with higher client ids first
  // This heavily improves the conflict algorithm.
  Array.from(sm.entries()).sort((a, b) => b[0] - a[0]).forEach(([client, clock]) => {
    // @ts-ignore
    writeStructs(encoder, store.clients.get(client), client, clock)
  })
}

/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder The decoder object to read data from.
 * @param {Doc} doc
 * @return {Map<number, Array<Item | GC>>}
 *
 * @private
 * @function
 */
export const readClientsStructRefs = (decoder, doc) => {
  /**
   * @type {Map<number, Array<Item | GC>>}
   */
  const clientRefs = map.create()
  const numOfStateUpdates = decoding.readVarUint(decoder.restDecoder)
  for (let i = 0; i < numOfStateUpdates; i++) {
    const numberOfStructs = decoding.readVarUint(decoder.restDecoder)
    /**
     * @type {Array<GC|Item>}
     */
    const refs = new Array(numberOfStructs)
    const client = decoder.readClient()
    let clock = decoding.readVarUint(decoder.restDecoder)
    // const start = performance.now()
    clientRefs.set(client, refs)
    for (let i = 0; i < numberOfStructs; i++) {
      const info = decoder.readInfo()
      if ((binary.BITS5 & info) !== 0) {
        /**
         * The optimized implementation doesn't use any variables because inlining variables is faster.
         * Below a non-optimized version is shown that implements the basic algorithm with
         * a few comments
         */
        const cantCopyParentInfo = (info & (binary.BIT7 | binary.BIT8)) === 0
        // If parent = null and neither left nor right are defined, then we know that `parent` is child of `y`
        // and we read the next string as parentYKey.
        // It indicates how we store/retrieve parent from `y.share`
        // @type {string|null}
        const struct = new Item(
          createID(client, clock),
          null, // leftd
          (info & binary.BIT8) === binary.BIT8 ? decoder.readLeftID() : null, // origin
          null, // right
          (info & binary.BIT7) === binary.BIT7 ? decoder.readRightID() : null, // right origin
          cantCopyParentInfo ? (decoder.readParentInfo() ? doc.get(decoder.readString()) : decoder.readLeftID()) : null, // parent
          cantCopyParentInfo && (info & binary.BIT6) === binary.BIT6 ? decoder.readString() : null, // parentSub
          readItemContent(decoder, info) // item content
        )
        /* A non-optimized implementation of the above algorithm:

        // The item that was originally to the left of this item.
        const origin = (info & binary.BIT8) === binary.BIT8 ? decoder.readLeftID() : null
        // The item that was originally to the right of this item.
        const rightOrigin = (info & binary.BIT7) === binary.BIT7 ? decoder.readRightID() : null
        const cantCopyParentInfo = (info & (binary.BIT7 | binary.BIT8)) === 0
        const hasParentYKey = cantCopyParentInfo ? decoder.readParentInfo() : false
        // If parent = null and neither left nor right are defined, then we know that `parent` is child of `y`
        // and we read the next string as parentYKey.
        // It indicates how we store/retrieve parent from `y.share`
        // @type {string|null}
        const parentYKey = cantCopyParentInfo && hasParentYKey ? decoder.readString() : null

        const struct = new Item(
          createID(client, clock),
          null, // leftd
          origin, // origin
          null, // right
          rightOrigin, // right origin
          cantCopyParentInfo && !hasParentYKey ? decoder.readLeftID() : (parentYKey !== null ? doc.get(parentYKey) : null), // parent
          cantCopyParentInfo && (info & binary.BIT6) === binary.BIT6 ? decoder.readString() : null, // parentSub
          readItemContent(decoder, info) // item content
        )
        */
        refs[i] = struct
        clock += struct.length
      } else {
        const len = decoder.readLen()
        refs[i] = new GC(createID(client, clock), len)
        clock += len
      }
    }
    // console.log('time to read: ', performance.now() - start) // @todo remove
  }
  return clientRefs
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
 * depends on struct3 (from client1). Therefore the max stack size is eqaul to `structReaders.length`.
 *
 * This method is implemented in a way so that we can resume computation if this update
 * causally depends on another update.
 *
 * @param {Transaction} transaction
 * @param {StructStore} store
 * @param {Map<number, { i: number, refs: (GC | Item)[] }} clientsStructRefs
 * @return { null | { restStructs: Uint8Array, missing: { client: number, clock: number } } }
 *
 * @private
 * @function
 */
const integrateStructs = (transaction, store, clientsStructRefs) => {
  const stack = store.pendingStack // @todo don't forget to append stackhead at the end
  // sort them so that we take the higher id first, in case of conflicts the lower id will probably not conflict with the id from the higher user.
  const clientsStructRefsIds = Array.from(clientsStructRefs.keys()).sort((a, b) => a - b)
  if (clientsStructRefsIds.length === 0) {
    return null
  }
  const getNextStructTarget = () => {
    let nextStructsTarget = /** @type {{i:number,refs:Array<GC|Item>}} */ (clientsStructRefs.get(clientsStructRefsIds[clientsStructRefsIds.length - 1]))
    while (nextStructsTarget.refs.length === nextStructsTarget.i) {
      clientsStructRefsIds.pop()
      if (clientsStructRefsIds.length > 0) {
        nextStructsTarget = /** @type {{i:number,refs:Array<GC|Item>}} */ (clientsStructRefs.get(clientsStructRefsIds[clientsStructRefsIds.length - 1]))
      } else {
        store.pendingClientsStructRefs.clear()
        return null
      }
    }
    return nextStructsTarget
  }
  let curStructsTarget = getNextStructTarget()
  if (curStructsTarget === null && stack.length === 0) {
    return
  }
  /**
   * @type {GC|Item}
   */
  let stackHead = stack.length > 0
    ? /** @type {GC|Item} */ (stack.pop())
    : /** @type {any} */ (curStructsTarget).refs[/** @type {any} */ (curStructsTarget).i++]
  // caching the state because it is used very often
  const state = new Map()
  // iterate over all struct readers until we are done
  while (true) {
    const localClock = map.setIfUndefined(state, stackHead.id.client, () => getState(store, stackHead.id.client))
    const offset = stackHead.id.clock < localClock ? localClock - stackHead.id.clock : 0
    if (stackHead.id.clock + offset !== localClock) {
      // A previous message from this client is missing
      // check if there is a pending structRef with a smaller clock and switch them
      /**
       * @type {{ refs: Array<GC|Item>, i: number }}
       */
      const structRefs = clientsStructRefs.get(stackHead.id.client) || { refs: [], i: 0 }
      if (structRefs.refs.length !== structRefs.i) {
        const r = structRefs.refs[structRefs.i]
        if (r.id.clock < stackHead.id.clock) {
          // put ref with smaller clock on stack instead and continue
          structRefs.refs[structRefs.i] = stackHead
          stackHead = r
          // sort the set because this approach might bring the list out of order
          structRefs.refs = structRefs.refs.slice(structRefs.i).sort((r1, r2) => r1.id.clock - r2.id.clock)
          structRefs.i = 0
          continue
        }
      }
      // wait until missing struct is available
      stack.push(stackHead)
      return
    }
    const missing = stackHead.getMissing(transaction, store)
    if (missing === null) {
      if (offset === 0 || offset < stackHead.length) {
        stackHead.integrate(transaction, offset)
        state.set(stackHead.id.client, stackHead.id.clock + stackHead.length)
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
    } else {
      // get the struct reader that has the missing struct
      /**
       * @type {{ refs: Array<GC|Item>, i: number }}
       */
      const structRefs = clientsStructRefs.get(missing) || { refs: [], i: 0 }
      if (structRefs.refs.length === structRefs.i) {
        // This update message causally depends on another update message.
        stack.push(stackHead)
        return
      }
      stack.push(stackHead)
      stackHead = structRefs.refs[structRefs.i++]
    }
  }
  store.pendingClientsStructRefs.clear()
}

/**
 * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
 * @param {Transaction} transaction
 *
 * @private
 * @function
 */
export const writeStructsFromTransaction = (encoder, transaction) => writeClientsStructs(encoder, transaction.doc.store, transaction.beforeState)

/**
 * Read the next Item in a Decoder and fill this Item with the read data.
 *
 * This is called when data is received from a remote peer.
 *
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder The decoder object to read data from.
 * @param {Transaction} transaction
 * @param {StructStore} store
 *
 * @private
 * @function
 */
export const readStructs = (decoder, transaction, store) => {
  let retry = false
  const doc = transaction.doc
  // let start = performance.now()
  const ss = readClientsStructRefs(decoder, doc)
  // console.log('time to read structs: ', performance.now() - start) // @todo remove
  // start = performance.now()

  // console.log('time to merge: ', performance.now() - start) // @todo remove
  // start = performance.now()
  const { missing, ssRest } = integrateStructs(transaction, store, ss)
  const pending = store.pendingStructs
  if (pending) {
    // check if we can apply something
    for (const [clock, client] of pending.missing) {
      if (clock < getState(store, client)) {
        retry = true
        break
      }
    }
  }
  if (missing) {
    if (pending) {
      pending.missing.set(missing.client, missing.clock)
      // @todo support v2 as well
      pending.update = mergeUpdates([pending.update, ssRest])
    } else {
      store.pendingStructs = { missing: map.create(), update: ssRest }
      store.pendingStructs.missing.set(missing.client, missing.clock)
    }
  }


  // console.log('time to integrate: ', performance.now() - start) // @todo remove
  // start = performance.now()
  const dsRest = readAndApplyDeleteSet(decoder, transaction, store)
  if (store.pendingDs) {
    // @todo we could make a lower-bound state-vector check as we do above
    const dsRest2 = readAndApplyDeleteSet(store.pendingDs, transaction, store)
    if (dsRest1 && dsRest2) {
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
    const update = store.pendingStructs.update
    store.pendingStructs = null
    applyUpdate(update)
  }
}

/**
 * Read and apply a document update.
 *
 * This function has the same effect as `applyUpdate` but accepts an decoder.
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
    readStructs(structDecoder, transaction, ydoc.store)
    readAndApplyDeleteSet(structDecoder, transaction, ydoc.store)
  }, transactionOrigin, false)

/**
 * Read and apply a document update.
 *
 * This function has the same effect as `applyUpdate` but accepts an decoder.
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
  writeDeleteSet(encoder, createDeleteSetFromStructStore(doc.store))
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
export const encodeStateAsUpdateV2 = (doc, encodedTargetStateVector, encoder = new UpdateEncoderV2()) => {
  const targetStateVector = encodedTargetStateVector == null ? new Map() : decodeStateVector(encodedTargetStateVector)
  writeStateAsUpdate(encoder, doc, targetStateVector)
  return encoder.toUint8Array()
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
export const decodeStateVectorV2 = decodedState => readStateVector(new DSDecoderV2(decoding.createDecoder(decodedState)))

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
 * @param {DSEncoderV1 | DSEncoderV2} encoder
 * @param {Map<number,number>} sv
 * @function
 */
export const writeStateVector = (encoder, sv) => {
  encoding.writeVarUint(encoder.restEncoder, sv.size)
  sv.forEach((clock, client) => {
    encoding.writeVarUint(encoder.restEncoder, client) // @todo use a special client decoder that is based on mapping
    encoding.writeVarUint(encoder.restEncoder, clock)
  })
  return encoder
}

/**
 * @param {DSEncoderV1 | DSEncoderV2} encoder
 * @param {Doc} doc
 *
 * @function
 */
export const writeDocumentStateVector = (encoder, doc) => writeStateVector(encoder, getStateVector(doc.store))

/**
 * Encode State as Uint8Array.
 *
 * @param {Doc} doc
 * @param {DSEncoderV1 | DSEncoderV2} [encoder]
 * @return {Uint8Array}
 *
 * @function
 */
export const encodeStateVectorV2 = (doc, encoder = new DSEncoderV2()) => {
  writeDocumentStateVector(encoder, doc)
  return encoder.toUint8Array()
}

/**
 * Encode State as Uint8Array.
 *
 * @param {Doc} doc
 * @return {Uint8Array}
 *
 * @function
 */
export const encodeStateVector = doc => encodeStateVectorV2(doc, new DSEncoderV1())
