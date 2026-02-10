import * as binary from 'lib0/binary'
import * as decoding from 'lib0/decoding'
import * as encoding from 'lib0/encoding'
import * as error from 'lib0/error'
import * as f from 'lib0/function'
import * as logging from 'lib0/logging'
import * as map from 'lib0/map'
import * as math from 'lib0/math'
import * as string from 'lib0/string'

import {
  ContentAny,
  ContentBinary,
  ContentDeleted,
  ContentDoc,
  ContentEmbed,
  ContentFormat,
  ContentJSON,
  ContentString,
  ContentType,
  createID,
  decodeStateVector,
  IdSetEncoderV1,
  IdSetEncoderV2,
  GC,
  Item,
  mergeIdSets,
  readIdSet,
  readItemContent,
  Skip,
  UpdateDecoderV1,
  UpdateDecoderV2,
  UpdateEncoderV1,
  UpdateEncoderV2,
  writeIdSet,
  createIdSet,
  Doc,
  applyUpdate,
  applyUpdateV2
} from '../internals.js'

import * as idset from './IdSet.js'

/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
 */
function * lazyStructReaderGenerator (decoder) {
  const numOfStateUpdates = decoding.readVarUint(decoder.restDecoder)
  for (let i = 0; i < numOfStateUpdates; i++) {
    const numberOfStructs = decoding.readVarUint(decoder.restDecoder)
    const client = decoder.readClient()
    let clock = decoding.readVarUint(decoder.restDecoder)
    for (let i = 0; i < numberOfStructs; i++) {
      const info = decoder.readInfo()
      // @todo use switch instead of ifs
      if (info === 10) {
        const len = decoding.readVarUint(decoder.restDecoder)
        yield new Skip(createID(client, clock), len)
        clock += len
      } else if ((binary.BITS5 & info) !== 0) {
        const cantCopyParentInfo = (info & (binary.BIT7 | binary.BIT8)) === 0
        // If parent = null and neither left nor right are defined, then we know that `parent` is child of `y`
        // and we read the next string as parentYKey.
        // It indicates how we store/retrieve parent from `y.share`
        // @type {string|null}
        const struct = new Item(
          createID(client, clock),
          null, // left
          (info & binary.BIT8) === binary.BIT8 ? decoder.readLeftID() : null, // origin
          null, // right
          (info & binary.BIT7) === binary.BIT7 ? decoder.readRightID() : null, // right origin
          // @ts-ignore Force writing a string here.
          cantCopyParentInfo ? (decoder.readParentInfo() ? decoder.readString() : decoder.readLeftID()) : null, // parent
          cantCopyParentInfo && (info & binary.BIT6) === binary.BIT6 ? decoder.readString() : null, // parentSub
          readItemContent(decoder, info) // item content
        )
        yield struct
        clock += struct.length
      } else {
        const len = decoder.readLen()
        yield new GC(createID(client, clock), len)
        clock += len
      }
    }
  }
}

export class LazyStructReader {
  /**
   * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder
   * @param {boolean} filterSkips
   */
  constructor (decoder, filterSkips) {
    this.gen = lazyStructReaderGenerator(decoder)
    /**
     * @type {null | Item | Skip | GC}
     */
    this.curr = null
    this.done = false
    this.filterSkips = filterSkips
    this.next()
  }

  /**
   * @return {Item | GC | Skip |null}
   */
  next () {
    // ignore "Skip" structs
    do {
      this.curr = this.gen.next().value || null
    } while (this.filterSkips && this.curr !== null && this.curr.constructor === Skip)
    return this.curr
  }
}

/**
 * @param {Uint8Array} update
 */
export const logUpdate = update => logUpdateV2(update, UpdateDecoderV1)

/**
 * @param {Uint8Array} update
 * @param {typeof UpdateDecoderV2 | typeof UpdateDecoderV1} [YDecoder]
 */
export const logUpdateV2 = (update, YDecoder = UpdateDecoderV2) => {
  const structs = []
  const updateDecoder = new YDecoder(decoding.createDecoder(update))
  const lazyDecoder = new LazyStructReader(updateDecoder, false)
  for (let curr = lazyDecoder.curr; curr !== null; curr = lazyDecoder.next()) {
    structs.push(curr)
  }
  logging.print('Structs: ', structs)
  const ds = readIdSet(updateDecoder)
  logging.print('DeleteSet: ', ds)
}

/**
 * @param {Uint8Array} update
 */
export const decodeUpdate = (update) => decodeUpdateV2(update, UpdateDecoderV1)

/**
 * @param {Uint8Array} update
 * @param {typeof UpdateDecoderV2 | typeof UpdateDecoderV1} [YDecoder]
 *
 */
export const decodeUpdateV2 = (update, YDecoder = UpdateDecoderV2) => {
  const structs = []
  const updateDecoder = new YDecoder(decoding.createDecoder(update))
  const lazyDecoder = new LazyStructReader(updateDecoder, false)
  for (let curr = lazyDecoder.curr; curr !== null; curr = lazyDecoder.next()) {
    structs.push(curr)
  }
  return {
    structs,
    ds: readIdSet(updateDecoder)
  }
}

export class LazyStructWriter {
  /**
   * @param {UpdateEncoderV1 | UpdateEncoderV2} encoder
   */
  constructor (encoder) {
    this.currClient = 0
    this.startClock = 0
    this.written = 0
    this.encoder = encoder
    /**
     * We want to write operations lazily, but also we need to know beforehand how many operations we want to write for each client.
     *
     * This kind of meta-information (#clients, #structs-per-client-written) is written to the restEncoder.
     *
     * We fragment the restEncoder and store a slice of it per-client until we know how many clients there are.
     * When we flush (toUint8Array) we write the restEncoder using the fragments and the meta-information.
     *
     * @type {Array<{ written: number, restEncoder: Uint8Array }>}
     */
    this.clientStructs = []
  }
}

/**
 * @param {Array<Uint8Array<ArrayBuffer>>} updates
 * @return {Uint8Array<ArrayBuffer>}
 */
export const mergeUpdates = updates => mergeUpdatesV2(updates, UpdateDecoderV1, UpdateEncoderV1)

/**
 * @param {Uint8Array} update
 * @param {typeof IdSetEncoderV1 | typeof IdSetEncoderV2} YEncoder
 * @param {typeof UpdateDecoderV1 | typeof UpdateDecoderV2} YDecoder
 * @return {Uint8Array<ArrayBuffer>}
 */
export const encodeStateVectorFromUpdateV2 = (update, YEncoder = IdSetEncoderV2, YDecoder = UpdateDecoderV2) => {
  const encoder = new YEncoder()
  const updateDecoder = new LazyStructReader(new YDecoder(decoding.createDecoder(update)), false)
  let curr = updateDecoder.curr
  if (curr !== null) {
    let size = 0
    let currClient = curr.id.client
    let stopCounting = curr.id.clock !== 0 // must start at 0
    let currClock = stopCounting ? 0 : curr.id.clock + curr.length
    for (; curr !== null; curr = updateDecoder.next()) {
      if (currClient !== curr.id.client) {
        if (currClock !== 0) {
          size++
          // We found a new client
          // write what we have to the encoder
          encoding.writeVarUint(encoder.restEncoder, currClient)
          encoding.writeVarUint(encoder.restEncoder, currClock)
        }
        currClient = curr.id.client
        currClock = 0
        stopCounting = curr.id.clock !== 0
      }
      // we ignore skips
      if (curr.constructor === Skip) {
        stopCounting = true
      }
      if (!stopCounting) {
        currClock = curr.id.clock + curr.length
      }
    }
    // write what we have
    if (currClock !== 0) {
      size++
      encoding.writeVarUint(encoder.restEncoder, currClient)
      encoding.writeVarUint(encoder.restEncoder, currClock)
    }
    // prepend the size of the state vector
    const enc = encoding.createEncoder()
    encoding.writeVarUint(enc, size)
    encoding.writeBinaryEncoder(enc, encoder.restEncoder)
    encoder.restEncoder = enc
    return encoder.toUint8Array()
  } else {
    encoding.writeVarUint(encoder.restEncoder, 0)
    return encoder.toUint8Array()
  }
}

/**
 * @param {Uint8Array} update
 * @return {Uint8Array<ArrayBuffer>}
 */
export const encodeStateVectorFromUpdate = update => encodeStateVectorFromUpdateV2(update, IdSetEncoderV1, UpdateDecoderV1)

/**
 * @param {Uint8Array} update
 * @param {typeof UpdateDecoderV2 | typeof UpdateDecoderV1} [YDecoder]
 * @return {import('./meta.js').ContentIds}
 */
export const createContentIdsFromUpdateV2 = (update, YDecoder = UpdateDecoderV2) => {
  const updateDecoder = new YDecoder(decoding.createDecoder(update))
  const lazyDecoder = new LazyStructReader(updateDecoder, true)
  const inserts = createIdSet()
  let lastClientId = -1
  let lastClock = 0
  let lastLen = 0
  for (let curr = lazyDecoder.curr; curr !== null; curr = lazyDecoder.next()) {
    const currId = curr.id
    if (lastClientId === currId.client && lastClock + lastLen === currId.clock) {
      // default case: extend prev entry
      lastLen += curr.length
    } else {
      if (lastClientId >= 0) {
        inserts.add(lastClientId, lastClock, lastLen)
      }
      lastClientId = currId.client
      lastClock = currId.clock
      lastLen = curr.length
    }
  }
  if (lastClientId >= 0) {
    inserts.add(lastClientId, lastClock, lastLen)
  }
  const deletes = readIdSet(updateDecoder)
  return { inserts, deletes }
}

/**
 * @param {Uint8Array} update
 * @return {import('./meta.js').ContentIds}
 */
export const createContentIdsFromUpdate = update => createContentIdsFromUpdateV2(update, UpdateDecoderV1)

/**
 * This method is intended to slice any kind of struct and retrieve the right part.
 * It does not handle side-effects, so it should only be used by the lazy-encoder.
 *
 * @param {Item | GC | Skip} left
 * @param {number} diff
 * @return {Item | GC}
 */
const sliceStruct = (left, diff) => {
  if (left.constructor === GC) {
    const { client, clock } = left.id
    return new GC(createID(client, clock + diff), left.length - diff)
  } else if (left.constructor === Skip) {
    const { client, clock } = left.id
    return new Skip(createID(client, clock + diff), left.length - diff)
  } else {
    const leftItem = /** @type {Item} */ (left)
    const { client, clock } = leftItem.id
    return new Item(
      createID(client, clock + diff),
      null,
      createID(client, clock + diff - 1),
      null,
      leftItem.rightOrigin,
      leftItem.parent,
      leftItem.parentSub,
      leftItem.content.splice(diff)
    )
  }
}

/**
 *
 * This function works similarly to `readUpdateV2`.
 *
 * @param {Array<Uint8Array<ArrayBuffer>>} updates
 * @param {typeof UpdateDecoderV1 | typeof UpdateDecoderV2} [YDecoder]
 * @param {typeof UpdateEncoderV1 | typeof UpdateEncoderV2} [YEncoder]
 * @return {Uint8Array<ArrayBuffer>}
 */
export const mergeUpdatesV2 = (updates, YDecoder = UpdateDecoderV2, YEncoder = UpdateEncoderV2) => {
  if (updates.length === 1) {
    return updates[0]
  }
  const updateDecoders = updates.map(update => new YDecoder(decoding.createDecoder(update)))
  let lazyStructDecoders = updateDecoders.map(decoder => new LazyStructReader(decoder, true))

  /**
   * @todo we don't need offset because we always slice before
   * @type {null | { struct: Item | GC | Skip, offset: number }}
   */
  let currWrite = null

  const updateEncoder = new YEncoder()
  // write structs lazily
  const lazyStructEncoder = new LazyStructWriter(updateEncoder)

  // Note: We need to ensure that all lazyStructDecoders are fully consumed
  // Note: Should merge document updates whenever possible - even from different updates
  // Note: Should handle that some operations cannot be applied yet ()

  while (true) {
    // Write higher clients first ⇒ sort by clientID & clock and remove decoders without content
    lazyStructDecoders = lazyStructDecoders.filter(dec => dec.curr !== null)
    lazyStructDecoders.sort(
      /** @type {function(any,any):number} */ (dec1, dec2) => {
        if (dec1.curr.id.client === dec2.curr.id.client) {
          const clockDiff = dec1.curr.id.clock - dec2.curr.id.clock
          if (clockDiff === 0) {
            // @todo remove references to skip since the structDecoders must filter Skips.
            return dec1.curr.constructor === dec2.curr.constructor
              ? 0
              : dec1.curr.constructor === Skip ? 1 : -1 // we are filtering skips anyway.
          } else {
            return clockDiff
          }
        } else {
          return dec2.curr.id.client - dec1.curr.id.client
        }
      }
    )
    if (lazyStructDecoders.length === 0) {
      break
    }
    const currDecoder = lazyStructDecoders[0]
    // write from currDecoder until the next operation is from another client or if filler-struct
    // then we need to reorder the decoders and find the next operation to write
    const firstClient = /** @type {Item | GC} */ (currDecoder.curr).id.client

    if (currWrite !== null) {
      let curr = /** @type {Item | GC | null} */ (currDecoder.curr)
      let iterated = false

      // iterate until we find something that we haven't written already
      // remember: first the high client-ids are written
      while (curr !== null && curr.id.clock + curr.length <= currWrite.struct.id.clock + currWrite.struct.length && curr.id.client >= currWrite.struct.id.client) {
        curr = currDecoder.next()
        iterated = true
      }
      if (
        curr === null || // current decoder is empty
        curr.id.client !== firstClient || // check whether there is another decoder that has has updates from `firstClient`
        (iterated && curr.id.clock > currWrite.struct.id.clock + currWrite.struct.length) // the above while loop was used and we are potentially missing updates
      ) {
        continue
      }

      if (firstClient !== currWrite.struct.id.client) {
        writeStructToLazyStructWriter(lazyStructEncoder, currWrite.struct, currWrite.offset, 0)
        currWrite = { struct: curr, offset: 0 }
        currDecoder.next()
      } else {
        if (currWrite.struct.id.clock + currWrite.struct.length < curr.id.clock) {
          // @todo write currStruct & set currStruct = Skip(clock = currStruct.id.clock + currStruct.length, length = curr.id.clock - self.clock)
          if (currWrite.struct.constructor === Skip) {
            // extend existing skip
            currWrite.struct.length = curr.id.clock + curr.length - currWrite.struct.id.clock
          } else {
            writeStructToLazyStructWriter(lazyStructEncoder, currWrite.struct, currWrite.offset, 0)
            const diff = curr.id.clock - currWrite.struct.id.clock - currWrite.struct.length
            /**
             * @type {Skip}
             */
            const struct = new Skip(createID(firstClient, currWrite.struct.id.clock + currWrite.struct.length), diff)
            currWrite = { struct, offset: 0 }
          }
        } else { // if (currWrite.struct.id.clock + currWrite.struct.length >= curr.id.clock) {
          const diff = currWrite.struct.id.clock + currWrite.struct.length - curr.id.clock
          if (diff > 0) {
            if (currWrite.struct.constructor === Skip) {
              // prefer to slice Skip because the other struct might contain more information
              currWrite.struct.length -= diff
            } else {
              curr = sliceStruct(curr, diff)
            }
          }
          if (!currWrite.struct.mergeWith(/** @type {any} */ (curr))) {
            writeStructToLazyStructWriter(lazyStructEncoder, currWrite.struct, currWrite.offset, 0)
            currWrite = { struct: curr, offset: 0 }
            currDecoder.next()
          }
        }
      }
    } else {
      currWrite = { struct: /** @type {Item | GC} */ (currDecoder.curr), offset: 0 }
      currDecoder.next()
    }
    for (
      let next = currDecoder.curr;
      next !== null && next.id.client === firstClient && next.id.clock === currWrite.struct.id.clock + currWrite.struct.length && next.constructor !== Skip;
      next = currDecoder.next()
    ) {
      writeStructToLazyStructWriter(lazyStructEncoder, currWrite.struct, currWrite.offset, 0)
      currWrite = { struct: next, offset: 0 }
    }
  }
  if (currWrite !== null) {
    writeStructToLazyStructWriter(lazyStructEncoder, currWrite.struct, currWrite.offset, 0)
    currWrite = null
  }
  finishLazyStructWriting(lazyStructEncoder)

  const dss = updateDecoders.map(decoder => readIdSet(decoder))
  const ds = mergeIdSets(dss)
  writeIdSet(updateEncoder, ds)
  return updateEncoder.toUint8Array()
}

/**
 * @deprecated
 * @param {Uint8Array} update
 * @param {Uint8Array} sv
 * @param {typeof UpdateDecoderV1 | typeof UpdateDecoderV2} [YDecoder]
 * @param {typeof UpdateEncoderV1 | typeof UpdateEncoderV2} [YEncoder]
 */
export const diffUpdateV2 = (update, sv, YDecoder = UpdateDecoderV2, YEncoder = UpdateEncoderV2) => {
  const state = decodeStateVector(sv)
  const encoder = new YEncoder()
  const lazyStructWriter = new LazyStructWriter(encoder)
  const decoder = new YDecoder(decoding.createDecoder(update))
  const reader = new LazyStructReader(decoder, false)
  while (reader.curr) {
    const curr = reader.curr
    const currClient = curr.id.client
    const svClock = state.get(currClient) || 0
    if (reader.curr.constructor === Skip) {
      // the first written struct shouldn't be a skip
      reader.next()
      continue
    }
    if (curr.id.clock + curr.length > svClock) {
      writeStructToLazyStructWriter(lazyStructWriter, curr, math.max(svClock - curr.id.clock, 0), 0)
      reader.next()
      while (reader.curr && reader.curr.id.client === currClient) {
        writeStructToLazyStructWriter(lazyStructWriter, reader.curr, 0, 0)
        reader.next()
      }
    } else {
      // read until something new comes up
      while (reader.curr && reader.curr.id.client === currClient && reader.curr.id.clock + reader.curr.length <= svClock) {
        reader.next()
      }
    }
  }
  finishLazyStructWriting(lazyStructWriter)
  // write ds
  const ds = readIdSet(decoder)
  writeIdSet(encoder, ds)
  return encoder.toUint8Array()
}

/**
 * @deprecated
 * @todo remove this in favor of intersectupdate
 *
 * @param {Uint8Array} update
 * @param {Uint8Array<ArrayBuffer>} sv
 */
export const diffUpdate = (update, sv) => diffUpdateV2(update, sv, UpdateDecoderV1, UpdateEncoderV1)

/**
 * @param {LazyStructWriter} lazyWriter
 */
const flushLazyStructWriter = lazyWriter => {
  if (lazyWriter.written > 0) {
    lazyWriter.clientStructs.push({ written: lazyWriter.written, restEncoder: encoding.toUint8Array(lazyWriter.encoder.restEncoder) })
    lazyWriter.encoder.restEncoder = encoding.createEncoder()
    lazyWriter.written = 0
  }
}

/**
 * @param {LazyStructWriter} lazyWriter
 * @param {Item | GC} struct
 * @param {number} offset
 * @param {number} offsetEnd
 */
const writeStructToLazyStructWriter = (lazyWriter, struct, offset, offsetEnd) => {
  // flush curr if we start another client
  if (lazyWriter.written > 0 && lazyWriter.currClient !== struct.id.client) {
    flushLazyStructWriter(lazyWriter)
  }
  if (lazyWriter.written === 0) {
    lazyWriter.currClient = struct.id.client
    // write next client
    lazyWriter.encoder.writeClient(struct.id.client)
    // write startClock
    encoding.writeVarUint(lazyWriter.encoder.restEncoder, struct.id.clock + offset)
  }
  struct.write(lazyWriter.encoder, offset, offsetEnd)
  lazyWriter.written++
}
/**
 * Call this function when we collected all parts and want to
 * put all the parts together. After calling this method,
 * you can continue using the UpdateEncoder.
 *
 * @param {LazyStructWriter} lazyWriter
 */
const finishLazyStructWriting = (lazyWriter) => {
  flushLazyStructWriter(lazyWriter)

  // this is a fresh encoder because we called flushCurr
  const restEncoder = lazyWriter.encoder.restEncoder

  /**
   * Now we put all the fragments together.
   * This works similarly to `writeClientsStructs`
   */

  // write # states that were updated - i.e. the clients
  encoding.writeVarUint(restEncoder, lazyWriter.clientStructs.length)

  for (let i = 0; i < lazyWriter.clientStructs.length; i++) {
    const partStructs = lazyWriter.clientStructs[i]
    /**
     * Works similarly to `writeStructs`
     */
    // write # encoded structs
    encoding.writeVarUint(restEncoder, partStructs.written)
    // write the rest of the fragment
    encoding.writeUint8Array(restEncoder, partStructs.restEncoder)
  }
}

/**
 * @param {Uint8Array} update
 * @param {function(Item|GC|Skip):Item|GC|Skip} blockTransformer
 * @param {typeof UpdateDecoderV2 | typeof UpdateDecoderV1} YDecoder
 * @param {typeof UpdateEncoderV2 | typeof UpdateEncoderV1 } YEncoder
 */
export const convertUpdateFormat = (update, blockTransformer, YDecoder, YEncoder) => {
  const updateDecoder = new YDecoder(decoding.createDecoder(update))
  const lazyDecoder = new LazyStructReader(updateDecoder, false)
  const updateEncoder = new YEncoder()
  const lazyWriter = new LazyStructWriter(updateEncoder)
  for (let curr = lazyDecoder.curr; curr !== null; curr = lazyDecoder.next()) {
    writeStructToLazyStructWriter(lazyWriter, blockTransformer(curr), 0, 0)
  }
  finishLazyStructWriting(lazyWriter)
  const ds = readIdSet(updateDecoder)
  writeIdSet(updateEncoder, ds)
  return updateEncoder.toUint8Array()
}

/**
 * @typedef {Object} ObfuscatorOptions
 * @property {boolean} [ObfuscatorOptions.formatting=true]
 * @property {boolean} [ObfuscatorOptions.subdocs=true]
 * @property {boolean} [ObfuscatorOptions.name=true] Whether to obfuscate nodeName / hookName
 */

/**
 * @param {ObfuscatorOptions} obfuscator
 */
const createObfuscator = ({ formatting = true, subdocs = true, name = true } = {}) => {
  let i = 0
  const mapKeyCache = map.create()
  const nodeNameCache = map.create()
  const formattingKeyCache = map.create()
  const formattingValueCache = map.create()
  formattingValueCache.set(null, null) // end of a formatting range should always be the end of a formatting range
  /**
   * @param {Item|GC|Skip} block
   * @return {Item|GC|Skip}
   */
  return block => {
    switch (block.constructor) {
      case GC:
      case Skip:
        return block
      case Item: {
        const item = /** @type {Item} */ (block)
        const content = item.content
        switch (content.constructor) {
          case ContentDeleted:
            break
          case ContentType: {
            if (name) {
              const type = /** @type {ContentType} */ (content).type
              if (type.name != null) {
                type.name = map.setIfUndefined(nodeNameCache, type.name, () => 'typename-' + i)
              }
            }
            break
          }
          case ContentAny: {
            const c = /** @type {ContentAny} */ (content)
            c.arr = c.arr.map(() => i)
            break
          }
          case ContentBinary: {
            const c = /** @type {ContentBinary} */ (content)
            c.content = new Uint8Array([i])
            break
          }
          case ContentDoc: {
            const c = /** @type {ContentDoc} */ (content)
            if (subdocs) {
              c.opts = {}
              c.doc.guid = i + ''
            }
            break
          }
          case ContentEmbed: {
            const c = /** @type {ContentEmbed} */ (content)
            c.embed = {}
            break
          }
          case ContentFormat: {
            const c = /** @type {ContentFormat} */ (content)
            if (formatting) {
              c.key = map.setIfUndefined(formattingKeyCache, c.key, () => i + '')
              c.value = map.setIfUndefined(formattingValueCache, c.value, () => ({ i }))
            }
            break
          }
          case ContentJSON: {
            const c = /** @type {ContentJSON} */ (content)
            c.arr = c.arr.map(() => i)
            break
          }
          case ContentString: {
            const c = /** @type {ContentString} */ (content)
            c.str = string.repeat((i % 10) + '', c.str.length)
            break
          }
          default:
            // unknown content type
            error.unexpectedCase()
        }
        if (item.parentSub) {
          item.parentSub = map.setIfUndefined(mapKeyCache, item.parentSub, () => i + '')
        }
        i++
        return block
      }
      default:
        // unknown block-type
        error.unexpectedCase()
    }
  }
}

/**
 * This function obfuscates the content of a Yjs update. This is useful to share
 * buggy Yjs documents while significantly limiting the possibility that a
 * developer can on the user. Note that it might still be possible to deduce
 * some information by analyzing the "structure" of the document or by analyzing
 * the typing behavior using the CRDT-related metadata that is still kept fully
 * intact.
 *
 * @param {Uint8Array} update
 * @param {ObfuscatorOptions} [opts]
 */
export const obfuscateUpdate = (update, opts) => convertUpdateFormat(update, createObfuscator(opts), UpdateDecoderV1, UpdateEncoderV1)

/**
 * @param {Uint8Array} update
 * @param {ObfuscatorOptions} [opts]
 */
export const obfuscateUpdateV2 = (update, opts) => convertUpdateFormat(update, createObfuscator(opts), UpdateDecoderV2, UpdateEncoderV2)

/**
 * @param {Uint8Array} update
 */
export const convertUpdateFormatV1ToV2 = update => convertUpdateFormat(update, f.id, UpdateDecoderV1, UpdateEncoderV2)

/**
 * @param {Uint8Array} update
 */
export const convertUpdateFormatV2ToV1 = update => convertUpdateFormat(update, f.id, UpdateDecoderV2, UpdateEncoderV1)

/**
 * Filter an update to only include content specified by a ContentIds pattern.
 *
 * This function extracts a subset of an update, keeping only the structs whose IDs
 * are present in `contentIds.inserts` and only the delete set entries that are
 * present in `contentIds.deletes`.
 *
 * Note: If a struct partially overlaps with the contentIds pattern, only the
 * overlapping portion is included in the result.
 *
 * @param {Uint8Array} update
 * @param {import('./meta.js').ContentIds} contentIds - Pattern specifying which content to include
 * @param {typeof UpdateDecoderV1 | typeof UpdateDecoderV2} [YDecoder]
 * @param {typeof UpdateEncoderV1 | typeof UpdateEncoderV2} [YEncoder]
 * @return {Uint8Array<ArrayBuffer>}
 */
export const intersectUpdateWithContentIdsV2 = (update, contentIds, YDecoder = UpdateDecoderV2, YEncoder = UpdateEncoderV2) => {
  const { inserts, deletes } = contentIds
  const encoder = new YEncoder()
  const lazyStructWriter = new LazyStructWriter(encoder)
  const decoder = new YDecoder(decoding.createDecoder(update))
  const reader = new LazyStructReader(decoder, true)

  while (reader.curr) {
    const currClientId = reader.curr.id.client
    let nextClock = reader.curr.id.clock
    let firstWrite = false
    while (reader.curr != null && reader.curr.id.client === currClientId) {
      const curr = reader.curr
      for (const slice of inserts.slice(currClientId, nextClock, curr.length)) {
        if (slice.exists) {
          const skipLen = slice.clock - nextClock
          if (skipLen > 0 && firstWrite) {
            // write missing skip
            writeStructToLazyStructWriter(lazyStructWriter, new Skip(createID(currClientId, nextClock), skipLen), 0, 0)
          }
          // write sliced content
          writeStructToLazyStructWriter(lazyStructWriter, curr, slice.clock - curr.id.clock, (curr.id.clock + curr.length) - (slice.clock + slice.len))
          nextClock = slice.clock + slice.len
          firstWrite = true
        }
      }
      reader.next()
    }
  }
  finishLazyStructWriting(lazyStructWriter)
  // Filter the delete set to only include entries in contentIds.deletes
  const ds = readIdSet(decoder)
  const filteredDs = idset.intersectSets(ds, deletes)
  writeIdSet(encoder, filteredDs)
  return encoder.toUint8Array()
}

/**
 * Filter an update (V1 format) to only include content specified by a ContentIds pattern.
 *
 * @param {Uint8Array} update
 * @param {import('./meta.js').ContentIds} contentIds - Pattern specifying which content to include
 * @return {Uint8Array<ArrayBuffer>}
 */
export const intersectUpdateWithContentIds = (update, contentIds) =>
  intersectUpdateWithContentIdsV2(update, contentIds, UpdateDecoderV1, UpdateEncoderV1)

/**
 * @param {Uint8Array} update
 * @param {import('./Doc.js').DocOpts} opts
 */
export const createDocFromUpdate = (update, opts = {}) => {
  const ydoc = new Doc(opts)
  applyUpdate(ydoc, update)
  return ydoc
}

/**
 * @param {Uint8Array} update
 * @param {import('./Doc.js').DocOpts} opts
 */
export const createDocFromUpdateV2 = (update, opts = {}) => {
  const ydoc = new Doc(opts)
  applyUpdateV2(ydoc, update)
  return ydoc
}
