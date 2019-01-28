
import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
import { Y } from '../utils/Y.js' // eslint-disable-line
import { writeDeleteStore, readFreshDeleteStore, DeleteStore } from '../utils/DeleteStore.js' // eslint-disable-line
import { writeStateMap, readStateMap } from '../utils/StateStore.js'

/**
 * @typedef {Object} HistorySnapshot
 * @property {DeleteStore} HistorySnapshot.ds
 * @property {Map<number,number>} HistorySnapshot.sm
 * @property {Map<number,string>} HistorySnapshot.userMap
 */

/**
 * @param {encoding.Encoder} encoder
 * @param {Y} y
 * @param {Map<number, string>} userMap
 */
export const writeHistorySnapshot = (encoder, y, userMap) => {
  writeDeleteStore(encoder, y.ds)
  writeStateMap(encoder, y.ss.state)
  encoding.writeVarUint(encoder, userMap.size)
  userMap.forEach((accountname, userid) => {
    encoding.writeVarUint(encoder, userid)
    encoding.writeVarString(encoder, accountname)
  })
}

/**
 *
 * @param {decoding.Decoder} decoder
 * @return {HistorySnapshot}
 */
export const readHistorySnapshot = decoder => {
  const ds = readFreshDeleteStore(decoder)
  const sm = readStateMap(decoder)
  const size = decoding.readVarUint(decoder)
  const userMap = new Map()
  for (let i = 0; i < size; i++) {
    const userid = decoding.readVarUint(decoder)
    const accountname = decoding.readVarString(decoder)
    userMap.set(userid, accountname)
  }
  return { ds, sm, userMap }
}
