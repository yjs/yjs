

import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
import { Y } from '../utils/Y.js' // eslint-disable-line
import { writeDeleteStore, readFreshDeleteStore, DeleteStore } from '../utils/DeleteStore.js' // eslint-disable-line
import { writeStateMap, readStateMap } from '../utils/StateStore.js'

/**
 * @typedef {Object} HistorySnapshot
 * @property {DeleteStore} HistorySnapshot.ds
 * @property {Map<number,number>} HistorySnapshot.sm
 */

/**
 * @param {encoding.Encoder} encoder
 * @param {Y} y
 */
export const writeHistorySnapshot = (encoder, y) => {
  writeDeleteStore(encoder, y.ds)
  writeStateMap(encoder, y.ss.state)
}

/**
 * 
 * @param {decoding.Decoder} decoder
 * @return {HistorySnapshot}
 */
export const readHistorySnapshot = (decoder) => {
  const ds = readFreshDeleteStore(decoder)
  const sm = readStateMap(decoder)
  return { ds, sm }
}