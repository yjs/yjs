/*
import fs from 'fs'
import path from 'path'
import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
import { createMutex } from '../lib/mutex.js'
import { encodeUpdate, encodeStructsDS, decodePersisted } from './decodePersisted.js'

function createFilePath (persistence, roomName) {
  // TODO: filename checking!
  return path.join(persistence.dir, roomName)
}

export class FilePersistence {
  constructor (dir) {
    this.dir = dir
    this._mutex = createMutex()
  }
  setRemoteUpdateCounter (roomName, remoteUpdateCounter) {
    // TODO: implement
    // nop
  }
  saveUpdate (room, y, encodedStructs) {
    return new Promise((resolve, reject) => {
      this._mutex(() => {
        const filePath = createFilePath(this, room)
        const updateMessage = encoding.createEncoder()
        encodeUpdate(y, encodedStructs, updateMessage)
        fs.appendFile(filePath, Buffer.from(encoding.toBuffer(updateMessage)), (err) => {
          if (err !== null) {
            reject(err)
          } else {
            resolve()
          }
        })
      }, resolve)
    })
  }
  saveState (roomName, y) {
    return new Promise((resolve, reject) => {
      const encoder = encoding.createEncoder()
      encodeStructsDS(y, encoder)
      const filePath = createFilePath(this, roomName)
      fs.writeFile(filePath, Buffer.from(encoding.toBuffer(encoder)), (err) => {
        if (err !== null) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }
  readState (roomName, y) {
    // Check if the file exists in the current directory.
    return new Promise((resolve, reject) => {
      const filePath = path.join(this.dir, roomName)
      fs.readFile(filePath, (err, data) => {
        if (err !== null) {
          resolve()
          // reject(err)
        } else {
          this._mutex(() => {
            console.info(`unpacking data (${data.length})`)
            console.time('unpacking')
            decodePersisted(y, decoding.createDecoder(data.buffer))
            console.timeEnd('unpacking')
          })
          resolve()
        }
      })
    })
  }
}
*/
