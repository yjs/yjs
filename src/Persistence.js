import BinaryEncoder from './Binary/Encoder.js'
import BinaryDecoder from './Binary/Decoder.js'
import { toBinary, fromBinary } from './MessageHandler/binaryEncode.js'
import { integrateRemoteStructs } from './MessageHandler/integrateRemoteStructs.js'

function getFreshCnf () {
  let buffer = new BinaryEncoder()
  buffer.writeUint32(0)
  return {
    len: 0,
    buffer
  }
}

export default class AbstractPersistence {
  constructor (opts) {
    this.opts = opts
    this.ys = new Map()
  }

  _init (y) {
    let cnf = this.ys.get(y)
    if (cnf === undefined) {
      cnf = getFreshCnf()
      this.ys.set(y, cnf)
      this.init(y)
      y.on('afterTransaction', (y, transaction) => {
        let cnf = this.ys.get(y)
        if (cnf.len > 0) {
          cnf.buffer.setUint32(0, cnf.len)
          this.saveUpdate(y, cnf.buffer.createBuffer(), transaction)
          let _cnf = getFreshCnf()
          for (let key in _cnf) {
            cnf[key] = _cnf[key]
          }
        }
      })
    }
    return this.retrieve(y).then(function () {
      return Promise.resolve(cnf)
    })
  }

  deinit (y) {
    this.ys.delete(y)
  }

  /* overwrite */
  saveUpdate (buffer) {
  }

  /**
   * Save struct to update buffer.
   * saveUpdate is called when transaction ends
   */
  saveStruct (y, struct) {
    let cnf = this.ys.get(y)
    if (cnf !== undefined) {
      struct._toBinary(cnf.buffer)
      cnf.len++
    }
  }

  /* overwrite */
  retrieve (y, model, updates) {
    y.transact(function () {
      if (model != null) {
        fromBinary(y, new BinaryDecoder(new Uint8Array(model)))
        y._setContentReady()
      }
      if (updates != null) {
        for (let i = 0; i < updates.length; i++) {
          integrateRemoteStructs(y, new BinaryDecoder(new Uint8Array(updates[i])))
          y._setContentReady()
        }
      }
    })
  }
  /* overwrite */
  persist (y) {
    return toBinary(y).createBuffer()
  }
}
