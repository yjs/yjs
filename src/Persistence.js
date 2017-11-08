// import BinaryEncoder from './Binary/Encoder.js'

export default function extendPersistence (Y) {
  class AbstractPersistence {
    constructor (y, opts) {
      this.y = y
      this.opts = opts
      this.saveOperationsBuffer = []
      this.log = Y.debug('y:persistence')
    }

    saveToMessageQueue (binary) {
      this.log('Room %s: Save message to message queue', this.y.options.connector.room)
    }

    saveOperations (ops) {
      ops = ops.map(function (op) {
        return Y.Struct[op.struct].encode(op)
      })
      /*
      const saveOperations = () => {
        if (this.saveOperationsBuffer.length > 0) {
          let encoder = new BinaryEncoder()
          encoder.writeVarString(this.opts.room)
          encoder.writeVarString('update')
          let ops = this.saveOperationsBuffer
          this.saveOperationsBuffer = []
          let length = ops.length
          encoder.writeUint32(length)
          for (var i = 0; i < length; i++) {
            let op = ops[i]
            Y.Struct[op.struct].binaryEncode(encoder, op)
          }
          this.saveToMessageQueue(encoder.createBuffer())
        }
      }
      */
      if (this.saveOperationsBuffer.length === 0) {
        this.saveOperationsBuffer = ops
      } else {
        this.saveOperationsBuffer = this.saveOperationsBuffer.concat(ops)
      }
    }
  }

  Y.AbstractPersistence = AbstractPersistence
}
