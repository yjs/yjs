/* eslint-env browser */

export const Uint8Array_ = Uint8Array

/**
 * @param {Array<number>} arr
 * @return {ArrayBuffer}
 */
export const createArrayBufferFromArray = arr => new Uint8Array_(arr).buffer

export const createUint8ArrayFromLen = len => new Uint8Array_(len)

/**
 * Create Uint8Array with initial content from buffer
 */
export const createUint8ArrayFromBuffer = (buffer, byteOffset, length) => new Uint8Array_(buffer, byteOffset, length)

/**
 * Create Uint8Array with initial content from buffer
 */
export const createUint8ArrayFromArrayBuffer = arraybuffer => new Uint8Array_(arraybuffer)
export const createArrayFromArrayBuffer = arraybuffer => Array.from(createUint8ArrayFromArrayBuffer(arraybuffer))

export const createPromise = f => new Promise(f)
/**
 * `Promise.all` wait for all promises in the array to resolve and return the result
 * @param {Array<Promise<any>>} arrp
 * @return {any}
 */
export const pall = arrp => Promise.all(arrp)
export const preject = reason => Promise.reject(reason)
export const presolve = res => Promise.resolve(res)

export const until = (timeout, check) => createPromise((resolve, reject) => {
  const hasTimeout = timeout > 0
  const untilInterval = () => {
    if (check()) {
      clearInterval(intervalHandle)
      resolve()
    } else if (hasTimeout) {
      timeout -= 10
      if (timeout < 0) {
        clearInterval(intervalHandle)
        reject(error('Timeout'))
      }
    }
  }
  const intervalHandle = setInterval(untilInterval, 10)
})

export const error = description => new Error(description)

export const max = (a, b) => a > b ? a : b

/**
 * @param {number} t Time to wait
 * @return {Promise} Promise that is resolved after t ms
 */
export const wait = t => createPromise(r => setTimeout(r, t))
