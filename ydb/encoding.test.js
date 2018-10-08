import * as encoding from './encoding.js'

/**
 * Check if binary encoding is compatible with golang binary encoding - binary.PutVarUint.
 *
 * Result: is compatible up to 32 bit: [0, 4294967295] / [0, 0xffffffff]. (max 32 bit unsigned integer)
 */
let err = null
try {
  const tests = [
    { in: 0, out: [0] },
    { in: 1, out: [1] },
    { in: 128, out: [128, 1] },
    { in: 200, out: [200, 1] },
    { in: 32, out: [32] },
    { in: 500, out: [244, 3] },
    { in: 256, out: [128, 2] },
    { in: 700, out: [188, 5] },
    { in: 1024, out: [128, 8] },
    { in: 1025, out: [129, 8] },
    { in: 4048, out: [208, 31] },
    { in: 5050, out: [186, 39] },
    { in: 1000000, out: [192, 132, 61] },
    { in: 34951959, out: [151, 166, 213, 16] },
    { in: 2147483646, out: [254, 255, 255, 255, 7] },
    { in: 2147483647, out: [255, 255, 255, 255, 7] },
    { in: 2147483648, out: [128, 128, 128, 128, 8] },
    { in: 2147483700, out: [180, 128, 128, 128, 8] },
    { in: 4294967294, out: [254, 255, 255, 255, 15] },
    { in: 4294967295, out: [255, 255, 255, 255, 15] }
  ]
  tests.forEach(test => {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, test.in)
    const buffer = new Uint8Array(encoding.toBuffer(encoder))
    if (buffer.byteLength !== test.out.length) {
      throw new Error('Length don\'t match!')
    }
    for (let j = 0; j < buffer.length; j++) {
      if (buffer[j] !== test[1][j]) {
        throw new Error('values don\'t match!')
      }
    }
  })
} catch (error) {
  err = error
} finally {
  console.log('YDB Client: Encoding varUint compatiblity test: ', err || 'success!')
}
