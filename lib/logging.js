
import * as globals from './globals.js'

let date = new Date().getTime()

const writeDate = () => {
  const oldDate = date
  date = new Date().getTime()
  return date - oldDate
}

export const print = (...args) => console.log(...args)
export const log = m => print(`%cydb-client: %c${m} %c+${writeDate()}ms`, 'color: blue;', '', 'color: blue')

export const fail = m => {
  throw new Error(m)
}

/**
 * @param {ArrayBuffer} buffer
 * @return {string}
 */
export const arrayBufferToString = buffer => JSON.stringify(Array.from(globals.createUint8ArrayFromBuffer(buffer)))
