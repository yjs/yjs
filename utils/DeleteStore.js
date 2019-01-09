/**
 * @module utils
 */

import { Tree } from '../lib/Tree.js'
import * as ID from './ID.js'

import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
import { deleteItemRange } from '../utils/structManipulation.js'

class DSNode {
  constructor (id, len, gc) {
    this._id = id
    this.len = len
    this.gc = gc
  }
  clone () {
    return new DSNode(this._id, this.len, this.gc)
  }
}

export class DeleteStore extends Tree {
  logTable () {
    const deletes = []
    this.iterate(null, null, n => {
      deletes.push({
        user: n._id.user,
        clock: n._id.clock,
        len: n.len,
        gc: n.gc
      })
    })
    console.table(deletes)
  }
  isDeleted (id) {
    var n = this.findWithUpperBound(id)
    return n !== null && n._id.user === id.user && id.clock < n._id.clock + n.len
  }
  mark (id, length, gc) {
    if (length === 0) return
    // Step 1. Unmark range
    const leftD = this.findWithUpperBound(ID.createID(id.user, id.clock - 1))
    // Resize left DSNode if necessary
    if (leftD !== null && leftD._id.user === id.user) {
      if (leftD._id.clock < id.clock && id.clock < leftD._id.clock + leftD.len) {
        // node is overlapping. need to resize
        if (id.clock + length < leftD._id.clock + leftD.len) {
          // overlaps new mark range and some more
          // create another DSNode to the right of new mark
          this.put(new DSNode(ID.createID(id.user, id.clock + length), leftD._id.clock + leftD.len - id.clock - length, leftD.gc))
        }
        // resize left DSNode
        leftD.len = id.clock - leftD._id.clock
      } // Otherwise there is no overlapping
    }
    // Resize right DSNode if necessary
    const upper = ID.createID(id.user, id.clock + length - 1)
    const rightD = this.findWithUpperBound(upper)
    if (rightD !== null && rightD._id.user === id.user) {
      if (rightD._id.clock < id.clock + length && id.clock <= rightD._id.clock && id.clock + length < rightD._id.clock + rightD.len) { // we only consider the case where we resize the node
        const d = id.clock + length - rightD._id.clock
        rightD._id = ID.createID(rightD._id.user, rightD._id.clock + d)
        rightD.len -= d
      }
    }
    // Now we only have to delete all inner marks
    const deleteNodeIds = []
    this.iterate(id, upper, m => {
      deleteNodeIds.push(m._id)
    })
    for (let i = deleteNodeIds.length - 1; i >= 0; i--) {
      this.delete(deleteNodeIds[i])
    }
    let newMark = new DSNode(id, length, gc)
    // Step 2. Check if we can extend left or right
    if (leftD !== null && leftD._id.user === id.user && leftD._id.clock + leftD.len === id.clock && leftD.gc === gc) {
      // We can extend left
      leftD.len += length
      newMark = leftD
    }
    const rightNext = this.find(ID.createID(id.user, id.clock + length))
    if (rightNext !== null && rightNext._id.user === id.user && id.clock + length === rightNext._id.clock && gc === rightNext.gc) {
      // We can merge newMark and rightNext
      newMark.len += rightNext.len
      this.delete(rightNext._id)
    }
    if (leftD !== newMark) {
      // only put if we didn't extend left
      this.put(newMark)
    }
  }
}


/**
 * Stringifies a message-encoded Delete Set.
 *
 * @param {decoding.Decoder} decoder
 * @return {string}
 */
export const stringifyDeleteStore = (decoder) => {
  let str = ''
  const dsLength = decoding.readUint32(decoder)
  for (let i = 0; i < dsLength; i++) {
    str += ' -' + decoding.readVarUint(decoder) + ':\n' // decodes user
    const dvLength = decoding.readUint32(decoder)
    for (let j = 0; j < dvLength; j++) {
      str += `clock: ${decoding.readVarUint(decoder)}, length: ${decoding.readVarUint(decoder)}, gc: ${decoding.readUint8(decoder) === 1}\n`
    }
  }
  return str
}

/**
 * Write the DeleteSet of a shared document to an Encoder.
 *
 * @param {encoding.Encoder} encoder
 * @param {DeleteStore} ds
 */
export const writeDeleteStore = (encoder, ds) => {
  let currentUser = null
  let currentLength
  let lastLenPos
  let numberOfUsers = 0
  const laterDSLenPus = encoding.length(encoder)
  encoding.writeUint32(encoder, 0)
  ds.iterate(null, null, n => {
    const user = n._id.user
    const clock = n._id.clock
    const len = n.len
    const gc = n.gc
    if (currentUser !== user) {
      numberOfUsers++
      // a new user was found
      if (currentUser !== null) { // happens on first iteration
        encoding.setUint32(encoder, lastLenPos, currentLength)
      }
      currentUser = user
      encoding.writeVarUint(encoder, user)
      // pseudo-fill pos
      lastLenPos = encoding.length(encoder)
      encoding.writeUint32(encoder, 0)
      currentLength = 0
    }
    encoding.writeVarUint(encoder, clock)
    encoding.writeVarUint(encoder, len)
    encoding.writeUint8(encoder, gc ? 1 : 0)
    currentLength++
  })
  if (currentUser !== null) { // happens on first iteration
    encoding.setUint32(encoder, lastLenPos, currentLength)
  }
  encoding.setUint32(encoder, laterDSLenPus, numberOfUsers)
}

/**
 * Read delete store from Decoder and create a fresh DeleteStore
 *
 * @param {decoding.Decoder} decoder
 * @return {DeleteStore}
 */
export const readFreshDeleteStore = decoder => {
  const ds = new DeleteStore()
  const dsLength = decoding.readUint32(decoder)
  for (let i = 0; i < dsLength; i++) {
    const user = decoding.readVarUint(decoder)
    const dvLength = decoding.readUint32(decoder)
    for (let j = 0; j < dvLength; j++) {
      const from = decoding.readVarUint(decoder)
      const len = decoding.readVarUint(decoder)
      const gc = decoding.readUint8(decoder)
      ds.put(new DSNode(ID.createID(user, from), len, gc))
    }
  }
  return ds
}

/**
 * Read delete set from Decoder and apply it to a shared document.
 *
 * @param {decoding.Decoder} decoder
 * @param {Y} y
 */
export const readDeleteStore = (decoder, y) => {
  const dsLength = decoding.readUint32(decoder)
  for (let i = 0; i < dsLength; i++) {
    const user = decoding.readVarUint(decoder)
    const dv = []
    const dvLength = decoding.readUint32(decoder)
    for (let j = 0; j < dvLength; j++) {
      const from = decoding.readVarUint(decoder)
      const len = decoding.readVarUint(decoder)
      const gc = decoding.readUint8(decoder) === 1
      dv.push({from, len, gc})
    }
    if (dvLength > 0) {
      const deletions = []
      let pos = 0
      let d = dv[pos]
      y.ds.iterate(ID.createID(user, 0), ID.createID(user, Number.MAX_VALUE), n => {
        // cases:
        // 1. d deletes something to the right of n
        //  => go to next n (break)
        // 2. d deletes something to the left of n
        //  => create deletions
        //  => reset d accordingly
        //  *)=> if d doesn't delete anything anymore, go to next d (continue)
        // 3. not 2) and d deletes something that also n deletes
        //  => reset d so that it doesn't contain n's deletion
        //  *)=> if d does not delete anything anymore, go to next d (continue)
        while (d != null) {
          var diff = 0 // describe the diff of length in 1) and 2)
          if (n._id.clock + n.len <= d.from) {
            // 1)
            break
          } else if (d.from < n._id.clock) {
            // 2)
            // delete maximum the len of d
            // else delete as much as possible
            diff = Math.min(n._id.clock - d.from, d.len)
            // deleteItemRange(y, user, d.from, diff, true)
            deletions.push([user, d.from, diff])
          } else {
            // 3)
            diff = n._id.clock + n.len - d.from // never null (see 1)
            if (d.gc && !n.gc) {
              // d marks as gc'd but n does not
              // then delete either way
              // deleteItemRange(y, user, d.from, Math.min(diff, d.len), true)
              deletions.push([user, d.from, Math.min(diff, d.len)])
            }
          }
          if (d.len <= diff) {
            // d doesn't delete anything anymore
            d = dv[++pos]
          } else {
            d.from = d.from + diff // reset pos
            d.len = d.len - diff // reset length
          }
        }
      })
      // TODO: It would be more performant to apply the deletes in the above loop
      // Adapt the Tree implementation to support delete while iterating
      for (let i = deletions.length - 1; i >= 0; i--) {
        const del = deletions[i]
        deleteItemRange(y, del[0], del[1], del[2], true)
      }
      // for the rest.. just apply it
      for (; pos < dv.length; pos++) {
        d = dv[pos]
        deleteItemRange(y, user, d.from, d.len, true)
        // deletions.push([user, d.from, d.len, d.gc)
      }
    }
  }
}
