/*
import { integrateRemoteStructs } from '../MessageHandler/integrateRemoteStructs.js'
import { writeStructs } from '../MessageHandler/syncStep1.js'
import { writeDeleteSet, readDeleteSet } from '../MessageHandler/deleteSet.js'

export const PERSIST_UPDATE = 0
/**
 * Write an update to an encoder.
 *
 * @param {Y} y A Yjs instance
 * @param {Encoder} updateEncoder I.e. transaction.encodedStructs
 *
export const encodeUpdate = (y, updateEncoder, encoder) => {
  encoder.writeVarUint(PERSIST_UPDATE)
  encoder.writeBinaryEncoder(updateEncoder)
}

export const PERSIST_STRUCTS_DS = 1

/**
 * Write the current Yjs data model to an encoder.
 *
 * @param {Y} y A Yjs instance
 * @param {Encoder} encoder An encoder to write to
 *
export const encodeStructsDS = (y, encoder) => {
  encoder.writeVarUint(PERSIST_STRUCTS_DS)
  writeStructs(y, encoder, new Map())
  writeDeleteSet(y, encoder)
}

/**
 * Feed the Yjs instance with the persisted state
 * @param {Y} y A Yjs instance.
 * @param {Decoder} decoder A Decoder instance that holds the file content.
 *
export const decodePersisted = (y, decoder) => {
  y.transact(() => {
    while (decoder.hasContent()) {
      const contentType = decoder.readVarUint()
      switch (contentType) {
        case PERSIST_UPDATE:
          integrateRemoteStructs(decoder, y)
          break
        case PERSIST_STRUCTS_DS:
          integrateRemoteStructs(decoder, y)
          readDeleteSet(y, decoder)
          break
      }
    }
  }, true)
}
*/
