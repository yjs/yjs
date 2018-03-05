import { getStruct } from '../Util/structReferences.js'
import BinaryDecoder from '../Binary/Decoder.js'
import { logID } from './messageToString.js'

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
 */
function _integrateRemoteStructHelper (y, struct) {
  const id = struct._id
  if (id === undefined) {
    struct._integrate(y)
  } else {
    if (y.ss.getState(id.user) > id.clock) {
      return
    }
    struct._integrate(y)
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
              }
            }
          })
          msu.delete(clock)
        }
      }
    }
  }
}

export function stringifyStructs (y, decoder, strBuilder) {
  const len = decoder.readUint32()
  for (let i = 0; i < len; i++) {
    let reference = decoder.readVarUint()
    let Constr = getStruct(reference)
    let struct = new Constr()
    let missing = struct._fromBinary(y, decoder)
    let logMessage = '  ' + struct._logString()
    if (missing.length > 0) {
      logMessage += ' .. missing: ' + missing.map(logID).join(', ')
    }
    strBuilder.push(logMessage)
  }
}

export function integrateRemoteStructs (y, decoder) {
  const len = decoder.readUint32()
  for (let i = 0; i < len; i++) {
    let reference = decoder.readVarUint()
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
      let _decoder = new BinaryDecoder(decoder.uint8arr)
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
