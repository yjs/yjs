import {
  createID,
  readItemContent,
  findIndexCleanStart,
  Skip,
  UpdateDecoderV1, UpdateDecoderV2, IdSet, Doc, GC, Item, ID, // eslint-disable-line
} from '../internals.js'

import * as decoding from 'lib0/decoding'
import * as binary from 'lib0/binary'
import * as map from 'lib0/map'

/**
 * @param {UpdateDecoderV1 | UpdateDecoderV2} decoder The decoder object to read data from.
 * @param {Doc} doc
 * @return {StructSet}
 *
 * @private
 * @function
 */
export const readStructSet = (decoder, doc) => {
  const clientRefs = new StructSet()
  const numOfStateUpdates = decoding.readVarUint(decoder.restDecoder)
  for (let i = 0; i < numOfStateUpdates; i++) {
    const numberOfStructs = decoding.readVarUint(decoder.restDecoder)
    /**
     * @type {Array<GC|Item>}
     */
    const refs = new Array(numberOfStructs)
    const client = decoder.readClient()
    let clock = decoding.readVarUint(decoder.restDecoder)
    clientRefs.clients.set(client, new StructRange(refs))
    for (let i = 0; i < numberOfStructs; i++) {
      const info = decoder.readInfo()
      switch (binary.BITS5 & info) {
        case 0: { // GC
          const len = decoder.readLen()
          refs[i] = new GC(createID(client, clock), len)
          clock += len
          break
        }
        case 10: { // Skip Struct (nothing to apply)
          // @todo we could reduce the amount of checks by adding Skip struct to clientRefs so we know that something is missing.
          const len = decoding.readVarUint(decoder.restDecoder)
          refs[i] = new Skip(createID(client, clock), len)
          clock += len
          break
        }
        default: { // Item with content
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
            null, // left
            (info & binary.BIT8) === binary.BIT8 ? decoder.readLeftID() : null, // origin
            null, // right
            (info & binary.BIT7) === binary.BIT7 ? decoder.readRightID() : null, // right origin
            cantCopyParentInfo ? (decoder.readParentInfo() ? doc.get(decoder.readString()) : decoder.readLeftID()) : null, // parent
            cantCopyParentInfo && (info & binary.BIT6) === binary.BIT6 ? decoder.readString() : null, // parentSub
            readItemContent(decoder, info) // item content
          )
          refs[i] = struct
          clock += struct.length
        }
      }
    }
  }
  return clientRefs
}

/**
 * Remove item-ranges from the StructSet.
 *
 * @param {StructSet} ss
 * @param {IdSet} exclude
 */
export const removeRangesFromStructSet = (ss, exclude) => {
  exclude.clients.forEach((range, client) => {
    const structs = /** @type {StructRange} */ (ss.clients.get(client))?.refs
    if (structs != null) {
      const firstStruct = structs[0]
      const lastStruct = structs[structs.length - 1]
      const idranges = range.getIds()
      for (let i = 0; i < idranges.length; i++) {
        const range = idranges[i]
        let startIndex = 0
        let endIndex = structs.length
        if (range.clock >= lastStruct.id.clock + lastStruct.length) continue
        if (range.clock > firstStruct.id.clock) {
          startIndex = findIndexCleanStart(null, structs, range.clock)
        }
        if (range.clock + range.len <= firstStruct.id.clock) continue
        if (range.clock + range.len < lastStruct.id.clock + lastStruct.length) {
          endIndex = findIndexCleanStart(null, structs, range.clock + range.len)
        }
        if (startIndex < endIndex) {
          structs[startIndex] = new Skip(new ID(client, range.clock), range.len)
          const d = endIndex - startIndex
          if (d > 1) {
            structs.splice(startIndex, d)
          }
        }
      }
    }
  })
}

class StructRange {
  /**
   * @param {Array<Item|GC>} refs
   */
  constructor (refs) {
    this.i = 0
    /**
     * @type {Array<Item | GC>}
     */
    this.refs = refs
  }
}

export class StructSet {
  constructor () {
    /**
     * @type {Map<number, StructRange>}
     */
    this.clients = map.create()
  }
}
