
import * as binary from 'lib0/binary.js'
import * as decoding from 'lib0/decoding.js'
import * as encoding from 'lib0/encoding.js'
import {
  createID,
  readItemContent,
  Item, GC, AbstractUpdateDecoder, AbstractUpdateEncoder, UpdateDecoderV1, UpdateDecoderV2, UpdateEncoderV1, UpdateEncoderV2 // eslint-disable-line
} from '../internals.js'

/**
 * @param {Array<Uint8Array>} updates
 * @return {Uint8Array}
 */
export const mergeUpdates = updates => {
  return updates[0]
}

/**
 * @param {Uint8Array} update
 * @param {Uint8Array} sv
 */
export const diffUpdate = (update, sv) => {
  return update
}

/**
 * @param {AbstractUpdateDecoder} decoder
 */
export function * lazyStructReaderGenerator (decoder) {
  const numOfStateUpdates = decoding.readVarUint(decoder.restDecoder)
  for (let i = 0; i < numOfStateUpdates; i++) {
    const numberOfStructs = decoding.readVarUint(decoder.restDecoder)
    const client = decoder.readClient()
    let clock = decoding.readVarUint(decoder.restDecoder)
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
   * @param {AbstractUpdateDecoder} decoder
   */
  constructor (decoder) {
    this.gen = lazyStructReaderGenerator(decoder)
    /**
     * @type {null | Item | GC}
     */
    this.curr = null
    this.done = false
    this.next()
  }

  /**
   * @return {Item | GC | null}
   */
  next () {
    return (this.curr = this.gen.next().value || null)
  }
}

export class LazyStructWriter {
  /**
   * @param {typeof UpdateEncoderV1 | typeof UpdateEncoderV2} YEncoder
   */
  constructor (YEncoder) {
    this.fresh = true
    this.currClient = 0
    this.startClock = 0
    this.written = 0
    this.encoder = new YEncoder()
    /**
     * @type {Array<{ client: number, clock: number, written: number, encoder: UpdateEncoderV1 | UpdateEncoderV2 }>}
     */
    this.clientStructs = []
    this.YEncoder = YEncoder
  }

  flushCurr () {
    if (!this.fresh) {
      this.clientStructs.push({ client: this.currClient, clock: this.startClock, written: this.written, encoder: this.encoder })
      this.fresh = true
    }
  }

  /**
   * @param {Item | GC} struct
   * @param {number} offset
   */
  write (struct, offset) {
    // flush curr if we start another client
    if (!this.fresh && this.currClient !== struct.id.client) {
      this.flushCurr()
      this.currClient = struct.id.client
      this.startClock = struct.id.clock
    }
    struct.write(this.encoder, offset)
    this.written++
  }

  toUint8Array () {
    const encoder = new this.YEncoder()

    /**
     * Works similarly to `writeClientsStructs`
     */

    // write # states that were updated - i.e. the clients
    encoding.writeVarUint(encoder.restEncoder, this.clientStructs.length)

    for (let i = 0; i < this.clientStructs.length; i++) {
      const partStructs = this.clientStructs[i]
      /**
       * Works similarly to `writeStructs`
       */
      // write # encoded structs
      encoding.writeVarUint(encoder.restEncoder, partStructs.written)
      encoder.writeClient(partStructs.client)
      encoding.writeVarUint(encoder.restEncoder, partStructs.clock)
      // append what we have been written so far
      encoder.append(partStructs.encoder)
    }
    return encoder.toUint8Array()
  }
}
