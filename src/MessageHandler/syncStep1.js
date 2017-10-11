import BinaryEncoder from './Util/Binary/Encoder.js'

export function stringifySyncStep1 (decoder, strBuilder) {
  let auth = decoder.readVarString()
  let protocolVersion = decoder.readVarUint()
  strBuilder.push(`
  - auth: "${auth}"
  - protocolVersion: ${protocolVersion}
`)
  // write SS
  strBuilder.push('  == SS: \n')
  let len = decoder.readUint32()
  for (let i = 0; i < len; i++) {
    let user = decoder.readVarUint()
    let clock = decoder.readVarUint()
    strBuilder.push(`     ${user}: ${clock}\n`)
  }
}

export function sendSyncStep1 (y, syncUser) {
  let encoder = new BinaryEncoder()
  encoder.writeVarString(y.room)
  encoder.writeVarString('sync step 1')
  encoder.writeVarString(y.connector.authInfo || '')
  encoder.writeVarUint(y.connector.protocolVersion)
  y.ss.writeStateSet(encoder)
  y.connector.send(syncUser, encoder.createBuffer())
}

export function readSyncStep1 (decoder, encoder, y, senderConn, sender) {
  let protocolVersion = decoder.readVarUint()
  // check protocol version
  if (protocolVersion !== y.connector.protocolVersion) {
    console.warn(
      `You tried to sync with a yjs instance that has a different protocol version
      (You: ${protocolVersion}, Client: ${protocolVersion}).
      The sync was stopped. You need to upgrade your dependencies (especially Yjs & the Connector)!
      `)
    y.destroy()
  }

  // send sync step 2
  encoder.writeVarString('sync step 2')
  encoder.writeVarString(y.connector.authInfo || '')
  writeDeleteSet(encoder)
  // reads ss and writes os
  writeOperations(encoder, decoder)
  y.connector.send(senderConn.uid, encoder.createBuffer())
  senderConn.receivedSyncStep2 = true
  if (y.connector.role === 'slave') {
    sendSyncStep1(y, sender)
  }
}
