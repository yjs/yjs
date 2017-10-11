import integrateRemoteStructs from './integrateRemoteStructs'
import { stringifyUpdate } from './update.js'
import ID from '../Util/ID'

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

export function writeSyncStep2 () {
  // TODO
}

export default function writeStructs (encoder, decoder, y, ss) {
  let lenPos = encoder.pos
  let len = 0
  encoder.writeUint32(0)
  for (let [user, clock] of ss) {
    y.os.iterate(new ID(user, clock), null, function (struct) {
      struct._toBinary(y, encoder)
      len++
    })
  }
  encoder.setUint32(lenPos, len)
}

export function readSyncStep2 (decoder, encoder, y, senderConn, sender) {
  // apply operations first
  applyDeleteSet(decoder)
  integrateRemoteStructs(decoder, encoder, y)
  // then apply ds
  y.connector._setSyncedWith(sender)
}
