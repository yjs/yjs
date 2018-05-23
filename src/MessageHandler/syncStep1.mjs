import BinaryEncoder from '../Util/Binary/Encoder.mjs'
import { readStateSet, writeStateSet } from './stateSet.mjs'
import { writeDeleteSet } from './deleteSet.mjs'
import ID from '../Util/ID/ID.mjs'
import { RootFakeUserID } from '../Util/ID/RootID.mjs'

export function stringifySyncStep1 (y, decoder, strBuilder) {
  let auth = decoder.readVarString()
  let protocolVersion = decoder.readVarUint()
  strBuilder.push(`  - auth: "${auth}"`)
  strBuilder.push(`  - protocolVersion: ${protocolVersion}`)
  // write SS
  let ssBuilder = []
  let len = decoder.readUint32()
  for (let i = 0; i < len; i++) {
    let user = decoder.readVarUint()
    let clock = decoder.readVarUint()
    ssBuilder.push(`(${user}:${clock})`)
  }
  strBuilder.push('  == SS: ' + ssBuilder.join(','))
}

export function sendSyncStep1 (connector, syncUser) {
  let encoder = new BinaryEncoder()
  encoder.writeVarString(connector.y.room)
  encoder.writeVarString('sync step 1')
  encoder.writeVarString(connector.authInfo || '')
  encoder.writeVarUint(connector.protocolVersion)
  writeStateSet(connector.y, encoder)
  connector.send(syncUser, encoder.createBuffer())
}

/**
 * @private
 * Write all Items that are not not included in ss to
 * the encoder object.
 */
export function writeStructs (y, encoder, ss) {
  const lenPos = encoder.pos
  encoder.writeUint32(0)
  let len = 0
  for (let user of y.ss.state.keys()) {
    let clock = ss.get(user) || 0
    if (user !== RootFakeUserID) {
      const minBound = new ID(user, clock)
      const overlappingLeft = y.os.findPrev(minBound)
      const rightID = overlappingLeft === null ? null : overlappingLeft._id
      if (rightID !== null && rightID.user === user && rightID.clock + overlappingLeft._length > clock) {
        const struct = overlappingLeft._clonePartial(clock - rightID.clock)
        struct._toBinary(encoder)
        len++
      }
      y.os.iterate(minBound, new ID(user, Number.MAX_VALUE), function (struct) {
        struct._toBinary(encoder)
        len++
      })
    }
  }
  encoder.setUint32(lenPos, len)
}

export function readSyncStep1 (decoder, encoder, y, senderConn, sender) {
  let protocolVersion = decoder.readVarUint()
  // check protocol version
  if (protocolVersion !== y.connector.protocolVersion) {
    console.warn(
      `You tried to sync with a Yjs instance that has a different protocol version
      (You: ${protocolVersion}, Client: ${protocolVersion}).
      `)
    y.destroy()
  }
  // write sync step 2
  encoder.writeVarString('sync step 2')
  encoder.writeVarString(y.connector.authInfo || '')
  const ss = readStateSet(decoder)
  writeStructs(y, encoder, ss)
  writeDeleteSet(y, encoder)
  y.connector.send(senderConn.uid, encoder.createBuffer())
  senderConn.receivedSyncStep2 = true
  if (y.connector.role === 'slave') {
    sendSyncStep1(y.connector, sender)
  }
}
