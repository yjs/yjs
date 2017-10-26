import { stringifyStructs, integrateRemoteStructs } from './integrateRemoteStructs.js'
import { readDeleteSet } from './deleteSet.js'

export function stringifySyncStep2 (y, decoder, strBuilder) {
  strBuilder.push('     - auth: ' + decoder.readVarString())
  strBuilder.push('  == OS:')
  stringifyStructs(y, decoder, strBuilder)
  // write DS to string
  strBuilder.push('  == DS:')
  let len = decoder.readUint32()
  for (let i = 0; i < len; i++) {
    let user = decoder.readVarUint()
    strBuilder.push(`    User: ${user}: `)
    let len2 = decoder.readUint32()
    for (let j = 0; j < len2; j++) {
      let from = decoder.readVarUint()
      let to = decoder.readVarUint()
      let gc = decoder.readUint8() === 1
      strBuilder.push(`[${from}, ${to}, ${gc}]`)
    }
  }
}

export function readSyncStep2 (decoder, encoder, y, senderConn, sender) {
  integrateRemoteStructs(decoder, encoder, y)
  readDeleteSet(y, decoder)
  y.connector._setSyncedWith(sender)
}
