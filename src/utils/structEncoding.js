
import {
  findIndexSS,
  exists,
  ItemBinaryRef,
  GCRef,
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

const structRefs = [
  ItemBinaryRef,
  GCRef,
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
 * @return {Iterator<AbstractRef>}
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
  _sm.forEach((clock, client) => {
    if (getState(store, client) > clock) {
      sm.set(client, clock)
    }
  })
  getStates(store).forEach((clock, client) => {
    if (!_sm.has(client)) {
      sm.set(client, 0)
    }
  })
  const encoderUserPosMap = map.create()
  // write # states that were updated
  encoding.writeVarUint(encoder, sm.size)
  sm.forEach((clock, client) => {
    // write first id
    writeID(encoder, createID(client, clock))
    encoderUserPosMap.set(client, encoding.length(encoder))
    // write diff to pos where structs are written
    // We will fill out this value later *)
    encoding.writeUint32(encoder, 0)
  })
  sm.forEach((clock, client) => {
    const decPos = encoderUserPosMap.get(client)
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
  /**
   * @type {Map<number,Iterator<AbstractRef>>}
   */
  const structReaders = new Map()
  const clientbeforeState = decoding.readVarUint(decoder)
  /**
   * @type {Array<AbstractRef>}
   */
  const stack = []
  const localState = getStates(store)
  for (let i = 0; i < clientbeforeState; i++) {
    const nextID = readID(decoder)
    const decoderPos = decoder.pos + decoding.readUint32(decoder)
    const structReaderDecoder = decoding.clone(decoder, decoderPos)
    const numberOfStructs = decoding.readVarUint(structReaderDecoder)
    structReaders.set(nextID.client, createStructReaderIterator(structReaderDecoder, numberOfStructs, nextID, localState.get(nextID.client) || 0))
  }
  for (const it of structReaders.values()) {
    // todo try for in of it
    for (let res = it.next(); !res.done; res = it.next()) {
      stack.push(res.value)
      while (stack.length > 0) {
        const ref = stack[stack.length - 1]
        const m = ref._missing
        while (m.length > 0) {
          const nextMissing = m[m.length - 1]
          if (!exists(store, nextMissing)) {
            // @ts-ignore must not be undefined, otherwise unexpected case
            stack.push(structReaders.get(nextMissing.client).next().value)
            break
          }
          ref._missing.pop()
        }
        if (m.length === 0) {
          const localClock = (localState.get(ref.id.client) || 0)
          const offset = ref.id.clock < localClock ? localClock - ref.id.clock : 0
          ref.toStruct(transaction, offset).integrate(transaction)
          stack.pop()
        }
      }
    }
  }
}
