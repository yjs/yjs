
import { getStruct } from '../Util/StructReferences.js'

export function stringifyUpdate (decoder, strBuilder) {
  while (decoder.length !== decoder.pos) {
    let reference = decoder.readVarUint()
    let Constr = getStruct(reference)
    let struct = new Constr()
    let missing = struct._fromBinary(decoder)
    let logMessage = struct._logString()
    if (missing.length > 0) {
      logMessage += missing.map(m => m._logString()).join(', ')
    }
    logMessage += '\n'
    strBuilder.push(logMessage)
  }
}

export { integrateRemoteStructs as readUpdate } from './integrateRemoteStructs.js'
