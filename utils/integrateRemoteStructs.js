/**
 * @module utils
 */

import { getStruct } from '../utils/structReferences.js'
import * as decoding from '../lib/decoding.js'
import { GC } from '../structs/GC.js'
import { Y } from '../utils/Y.js' // eslint-disable-line
import { Item } from '../structs/Item.js' // eslint-disable-line

class MissingEntry {
  constructor (decoder, missing, struct) {
    this.decoder = decoder
    this.missing = missing.length
    this.struct = struct
  }
}

/**
 * @private
 * Integrate remote struct
 * When a remote struct is integrated, other structs might be ready to ready to
 * integrate.
 * @param {Y} y
 * @param {Item} struct
 */
function _integrateRemoteStructHelper (y, struct) {
  const id = struct._id
  if (id === undefined) {
    struct._integrate(y)
  } else {
    if (y.ss.getState(id.user) > id.clock) {
      return
    }
    if (!y.gcEnabled || struct.constructor === GC || (struct._parent.constructor !== GC && struct._parent._deleted === false)) {
      // Is either a GC or Item with an undeleted parent
      // save to integrate
      struct._integrate(y)
    } else {
      // Is an Item. parent was deleted.
      struct._gc(y)
    }
    let msu = y._missingStructs.get(id.user)
    if (msu != null) {
      let clock = id.clock
      const finalClock = clock + struct._length
      for (;clock < finalClock; clock++) {
        const missingStructs = msu.get(clock)
        if (missingStructs !== undefined) {
          missingStructs.forEach(missingDef => {
            missingDef.missing--
            if (missingDef.missing === 0) {
              const decoder = missingDef.decoder
              let oldPos = decoder.pos
              let missing = missingDef.struct._fromBinary(y, decoder)
              decoder.pos = oldPos
              if (missing.length === 0) {
                y._readyToIntegrate.push(missingDef.struct)
              } else {
                // TODO: throw error here
              }
            }
          })
          msu.delete(clock)
        }
      }
      if (msu.size === 0) {
        y._missingStructs.delete(id.user)
      }
    }
  }
}

/**
 * @param {decoding.Decoder} decoder
 * @param {Y} y
 */
export const integrateRemoteStructs = (decoder, y) => {
  const len = decoding.readUint32(decoder)
  for (let i = 0; i < len; i++) {
    let reference = decoding.readVarUint(decoder)
    let Constr = getStruct(reference)
    let struct = new Constr()
    let decoderPos = decoder.pos
    let missing = struct._fromBinary(y, decoder)
    if (missing.length === 0) {
      while (struct != null) {
        _integrateRemoteStructHelper(y, struct)
        struct = y._readyToIntegrate.shift()
      }
    } else {
      let _decoder = decoding.createDecoder(decoder.arr.buffer)
      _decoder.pos = decoderPos
      let missingEntry = new MissingEntry(_decoder, missing, struct)
      let missingStructs = y._missingStructs
      for (let i = missing.length - 1; i >= 0; i--) {
        let m = missing[i]
        if (!missingStructs.has(m.user)) {
          missingStructs.set(m.user, new Map())
        }
        let msu = missingStructs.get(m.user)
        if (!msu.has(m.clock)) {
          msu.set(m.clock, [])
        }
        let mArray = msu = msu.get(m.clock)
        mArray.push(missingEntry)
      }
    }
  }
}

// TODO: use this above / refactor
/**
 * @param {decoding.Decoder} decoder
 * @param {Y} y
 */
export const integrateRemoteStruct = (decoder, y) => {
  let reference = decoding.readVarUint(decoder)
  let Constr = getStruct(reference)
  let struct = new Constr()
  let decoderPos = decoder.pos
  let missing = struct._fromBinary(y, decoder)
  if (missing.length === 0) {
    while (struct != null) {
      _integrateRemoteStructHelper(y, struct)
      struct = y._readyToIntegrate.shift()
    }
  } else {
    let _decoder = decoding.createDecoder(decoder.arr.buffer)
    _decoder.pos = decoderPos
    let missingEntry = new MissingEntry(_decoder, missing, struct)
    let missingStructs = y._missingStructs
    for (let i = missing.length - 1; i >= 0; i--) {
      let m = missing[i]
      if (!missingStructs.has(m.user)) {
        missingStructs.set(m.user, new Map())
      }
      let msu = missingStructs.get(m.user)
      if (!msu.has(m.clock)) {
        msu.set(m.clock, [])
      }
      let mArray = msu = msu.get(m.clock)
      mArray.push(missingEntry)
    }
  }
}
