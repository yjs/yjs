
import {
  findIndexSS,
  exists,
  GCRef,
  ItemBinaryRef,
  ItemDeletedRef,
  ItemEmbedRef,
  ItemFormatRef,
  ItemJSONRef,
  ItemStringRef,
  ItemTypeRef,
  writeID,
  createID,
  readID,
  getState,
  getStates,
  readDeleteSet,
  writeDeleteSet,
  createDeleteSetFromStructStore,
  Transaction, AbstractStruct, AbstractRef, StructStore, ID // eslint-disable-line
} from '../internals.js'

import * as encoding from 'lib0/encoding.js'
import * as decoding from 'lib0/decoding.js'
import * as map from 'lib0/map.js'
import * as binary from 'lib0/binary.js'
import * as iterator from 'lib0/iterator.js'

/**
 * @typedef {Map<number, number>} StateMap
 */

export const structRefs = [
  GCRef,
  ItemBinaryRef,
  ItemDeletedRef,
  ItemEmbedRef,
  ItemFormatRef,
  ItemJSONRef,
  ItemStringRef,
  ItemTypeRef
]

/**
 * @param {decoding.Decoder} decoder
 * @param {number} structsLen
 * @param {ID} nextID
 * @param {number} localState next expected clock by nextID.client
 * @return {IterableIterator<AbstractRef>}
 */
const createStructReaderIterator = (decoder, structsLen, nextID, localState) => iterator.createIterator(() => {
  let done = false
  let value
  do {
    if (structsLen === 0) {
      done = true
      value = undefined
      break
    }
    const info = decoding.readUint8(decoder)
    value = new structRefs[binary.BITS5 & info](decoder, nextID, info)
    nextID = createID(nextID.client, nextID.clock + value.length)
    structsLen--
  } while (nextID.clock <= localState) // read until we find something new (check nextID.clock instead because it equals `clock+len`)
  return { done, value }
})

/**
 * @param {encoding.Encoder} encoder
 * @param {Transaction} transaction
 */
export const writeStructsFromTransaction = (encoder, transaction) => writeStructs(encoder, transaction.y.store, transaction.beforeState)

/**
 * @param {encoding.Encoder} encoder
 * @param {StructStore} store
 * @param {StateMap} _sm
 */
export const writeStructs = (encoder, store, _sm) => {
  // we filter all valid _sm entries into sm
  const sm = new Map()
  const encoderUserPosMap = map.create()
  const startMessagePos = encoding.length(encoder)
  // write diff to pos of end of this message
  // we use it in readStructs to jump ahead to the end of the message
  encoding.writeUint32(encoder, 0)
  _sm.forEach((clock, client) => {
    // only write if new structs are available
    if (getState(store, client) > clock) {
      sm.set(client, clock)
    }
  })
  getStates(store).forEach((clock, client) => {
    if (!_sm.has(client)) {
      sm.set(client, 0)
    }
  })
  // write # states that were updated
  encoding.writeVarUint(encoder, sm.size)
  sm.forEach((clock, client) => {
    // write first id
    writeID(encoder, createID(client, clock))
    encoderUserPosMap.set(client, encoding.length(encoder))
    // write diff to pos where structs are written
    encoding.writeUint32(encoder, 0)
  })
  sm.forEach((clock, client) => {
    const decPos = encoderUserPosMap.get(client)
    // fill out diff to pos where structs are written
    encoding.setUint32(encoder, decPos, encoding.length(encoder) - decPos)
    /**
     * @type {Array<AbstractStruct>}
     */
    // @ts-ignore
    const structs = store.clients.get(client)
    const startNewStructs = findIndexSS(structs, clock)
    // write # encoded structs
    encoding.writeVarUint(encoder, structs.length - startNewStructs)
    const firstStruct = structs[startNewStructs]
    // write first struct with an offset (may be 0)
    firstStruct.write(encoder, clock - firstStruct.id.clock, 0)
    for (let i = startNewStructs + 1; i < structs.length; i++) {
      structs[i].write(encoder, 0, 0)
    }
  })
  // fill out diff to pos of end of message
  encoding.setUint32(encoder, startMessagePos, encoding.length(encoder) - startMessagePos)
}

/**
 * @param {decoding.Decoder} decoder The decoder object to read data from.
 * @param {Map<number,number>} localState
 * @return {Map<number,IterableIterator<AbstractRef>>}
 */
const readStructReaders = (decoder, localState) => {
  /**
   * @type {Map<number,IterableIterator<AbstractRef>>}
   */
  const structReaders = new Map()
  const endOfMessagePos = decoder.pos + decoding.readUint32(decoder)
  const clientbeforeState = decoding.readVarUint(decoder)
  for (let i = 0; i < clientbeforeState; i++) {
    const nextID = readID(decoder)
    const decoderPos = decoder.pos + decoding.readUint32(decoder)
    const structReaderDecoder = decoding.clone(decoder, decoderPos)
    const numberOfStructs = decoding.readVarUint(structReaderDecoder)
    structReaders.set(nextID.client, createStructReaderIterator(structReaderDecoder, numberOfStructs, nextID, localState.get(nextID.client) || 0))
  }
  // Decoder is still stuck at creating struct readers.
  // Jump ahead to end of message so that reading can continue.
  // We will use the created struct readers for the remaining part of this workflow.
  decoder.pos = endOfMessagePos
  return structReaders
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
 * @param {Map<number,number>} localState
 * @param {Map<number,IterableIterator<AbstractRef>>} structReaders
 * @param {Array<AbstractRef>} stack Stack of pending structs waiting for struct dependencies.
 *                                   Maximum length of stack is structReaders.size.
 *
 * @todo reimplement without iterators - read everything in arrays instead
 */
const execStructReaders = (transaction, store, localState, structReaders, stack) => {
  // iterate over all struct readers until we are done
  const structReaderIterator = structReaders.values()
  let structReaderIteratorResult = structReaderIterator.next()
  while (stack.length !== 0 || !structReaderIteratorResult.done) {
    if (stack.length === 0) {
      // stack is empty. We know that there there are more structReaders to be processed
      const nextStructRes = structReaderIteratorResult.value.next()
      if (nextStructRes.done) {
        // current structReaderIteratorResult is empty, use next one
        structReaderIteratorResult = structReaderIterator.next()
      } else {
        stack.push(nextStructRes.value)
      }
    } else {
      const ref = stack[stack.length - 1]
      const m = ref._missing
      while (m.length > 0) {
        const missing = m[m.length - 1]
        if (!exists(store, missing)) {
          // get the struct reader that has the missing struct
          const reader = structReaders.get(missing.client)
          const nextRef = reader === undefined ? undefined : reader.next().value
          if (nextRef === undefined) {
            // This update message causally depends on another update message.
            // Store current stack and readers in StructStore and resume the computation at another time
            store.pendingStructReaders.add({ stack, structReaders, missing })
            return
          }
          stack.push(nextRef)
          break
        }
        ref._missing.pop()
      }
      if (m.length === 0) {
        const localClock = (localState.get(ref.id.client) || 0)
        const offset = ref.id.clock < localClock ? localClock - ref.id.clock : 0
        if (offset < ref.length) {
          ref.toStruct(transaction.y, store, offset).integrate(transaction)
        }
        stack.pop()
      }
    }
  }
  if (stack.length > 0) {
    store.pendingStructReaders.add({ stack, structReaders, missing: stack[stack.length - 1].id })
  }
}

/**
 * Try to resume pending struct readers in `store.pendingReaders` while `pendingReaders.nextMissing`
 * exists.
 *
 * @param {Transaction} transaction
 * @param {StructStore} store
 */
const tryResumePendingStructReaders = (transaction, store) => {
  let resume = true
  const pendingReaders = store.pendingStructReaders
  while (resume) {
    resume = false
    for (const pendingReader of pendingReaders) {
      if (exists(store, pendingReader.missing)) {
        resume = true // found at least one more reader to execute
        pendingReaders.delete(pendingReader)
        execStructReaders(transaction, store, getStates(store), pendingReader.structReaders, pendingReader.stack)
      }
    }
  }
}

/**
 * @param {Transaction} transaction
 * @param {StructStore} store
 */
export const tryResumePendingDeleteReaders = (transaction, store) => {
  const pendingReaders = store.pendingDeleteReaders
  store.pendingDeleteReaders = []
  for (let i = 0; i < pendingReaders.length; i++) {
    readDeleteSet(pendingReaders[i], transaction, store)
  }
}

/**
 * Read the next Item in a Decoder and fill this Item with the read data.
 *
 * This is called when data is received from a remote peer.
 *
 * @param {decoding.Decoder} decoder The decoder object to read data from.
 * @param {Transaction} transaction
 * @param {StructStore} store
 *
 * @private
 */
export const readStructs = (decoder, transaction, store) => {
  const localState = getStates(store)
  const readers = readStructReaders(decoder, localState)
  execStructReaders(transaction, store, localState, readers, [])
  tryResumePendingStructReaders(transaction, store)
  tryResumePendingDeleteReaders(transaction, store)
}

/**
 * @param {decoding.Decoder} decoder
 * @param {Transaction} transaction
 * @param {StructStore} store
 */
export const readModel = (decoder, transaction, store) => {
  readStructs(decoder, transaction, store)
  readDeleteSet(decoder, transaction, store)
}

/**
 * @param {encoding.Encoder} encoder
 * @param {StructStore} store
 * @param {Map<number,number>} [targetState] The state of the target that receives the update. Leave empty to write all known structs
 */
export const writeModel = (encoder, store, targetState = new Map()) => {
  writeStructs(encoder, store, targetState)
  writeDeleteSet(encoder, createDeleteSetFromStructStore(store))
}
