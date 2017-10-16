import { integrateRemoteStructs } from './integrateRemoteStructs.js'
import { stringifyUpdate } from './update.js'
import { readDeleteSet } from './deleteSet.js'

export function stringifySyncStep2 (decoder, strBuilder) {
  strBuilder.push('     - auth: ' + decoder.readVarString() + '\n')
  strBuilder.push('  == OS: \n')
  stringifyUpdate(decoder, strBuilder)
  // write DS to string
  strBuilder.push('  == DS: \n')
  let len = decoder.readUint32()
  for (let i = 0; i < len; i++) {
    let user = decoder.readVarUint()
    strBuilder.push(`    User: ${user}: `)
    let len2 = decoder.readVarUint()
    for (let j = 0; j < len2; j++) {
      let from = decoder.readVarUint()
      let to = decoder.readVarUint()
      let gc = decoder.readUint8() === 1
      strBuilder.push(`[${from}, ${to}, ${gc}]`)
    }
  }
}

export function readSyncStep2 (decoder, encoder, y, senderConn, sender) {
  readDeleteSet(y, decoder)
  integrateRemoteStructs(decoder, encoder, y)
  y.connector._setSyncedWith(sender)
}
