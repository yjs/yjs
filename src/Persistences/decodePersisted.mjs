import { integrateRemoteStructs } from '../MessageHandler/integrateRemoteStructs.mjs'
import { writeStructs } from '../MessageHandler/syncStep1.mjs'
import { writeDeleteSet, readDeleteSet } from '../MessageHandler/deleteSet.mjs'

const PERSIST_UPDATE = 0
/**
 * Write an update to an encoder.
 *
 * @param {Yjs} y A Yjs instance
 * @param {BinaryEncoder} updateEncoder I.e. transaction.encodedStructs
 */
export function encodeUpdate (y, updateEncoder, encoder) {
  encoder.writeVarUint(PERSIST_UPDATE)
  encoder.writeBinaryEncoder(updateEncoder)
}

const PERSIST_STRUCTS_DS = 1

/**
 * Write the current Yjs data model to an encoder.
 *
 * @param {Yjs} y A Yjs instance
 * @param {BinaryEncoder} encoder An encoder to write to
 */
export function encodeStructsDS (y, encoder) {
  encoder.writeVarUint(PERSIST_STRUCTS_DS)
  writeStructs(y, encoder, new Map())
  writeDeleteSet(y, encoder)
}

/**
 * Feed the Yjs instance with the persisted state
 * @param {Yjs} y A Yjs instance.
 * @param {BinaryDecoder} decoder A Decoder instance that holds the file content.
 */
export function decodePersisted (y, decoder) {
  y.transact(() => {
    while (decoder.hasContent()) {
      const contentType = decoder.readVarUint()
      switch (contentType) {
        case PERSIST_UPDATE:
          integrateRemoteStructs(y, decoder)
          break
        case PERSIST_STRUCTS_DS:
          integrateRemoteStructs(y, decoder)
          readDeleteSet(y, decoder)
          break
      }
    }
  }, true)
}
