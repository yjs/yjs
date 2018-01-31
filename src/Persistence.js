import BinaryEncoder from './Binary/Encoder.js'
import BinaryDecoder from './Binary/Decoder.js'
import { toBinary, fromBinary } from './MessageHandler/binaryEncode.js'
import { integrateRemoteStructs } from './MessageHandler/integrateRemoteStructs.js'
import { createMutualExclude } from './Util/mutualExclude.js'

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
      cnf.mutualExclude = createMutualExclude()
      this.ys.set(y, cnf)
      return this.init(y).then(() => {
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
        return this.retrieve(y)
      }).then(function () {
        return Promise.resolve(cnf)
      })
    } else {
      return Promise.resolve(cnf)
    }
  }
  deinit (y) {
    this.ys.delete(y)
    y.persistence = null
  }

  destroy () {
    this.ys = null
  }

  /**
   * Remove all persisted data that belongs to a room.
   * Automatically destroys all Yjs all Yjs instances that persist to
   * the room. If `destroyYjsInstances = false` the persistence functionality
   * will be removed from the Yjs instances.
   *
   * ** Must be overwritten! **
   */
  removePersistedData (room, destroyYjsInstances = true) {
    this.ys.forEach((cnf, y) => {
      if (y.room === room) {
        if (destroyYjsInstances) {
          y.destroy()
        } else {
          this.deinit(y)
        }
      }
    })
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
      cnf.mutualExclude(function () {
        struct._toBinary(cnf.buffer)
        cnf.len++
      })
    }
  }

  /* overwrite */
  retrieve (y, model, updates) {
    let cnf = this.ys.get(y)
    if (cnf !== undefined) {
      cnf.mutualExclude(function () {
        y.transact(function () {
          if (model != null) {
            fromBinary(y, new BinaryDecoder(new Uint8Array(model)))
          }
          if (updates != null) {
            for (let i = 0; i < updates.length; i++) {
              integrateRemoteStructs(y, new BinaryDecoder(new Uint8Array(updates[i])))
            }
          }
        })
        y.emit('persistenceReady')
      })
    }
  }

  /* overwrite */
  persist (y) {
    return toBinary(y).createBuffer()
  }
}
