import { test } from 'cutest'
import { generateRandomUint32 } from '../utils/generateRandomUint32.js'
import * as encoding from '../lib/encoding.js'
import * as decoding from '../lib/decoding.js'
import * as random from '../lib/prng/prng.js'

function testEncoding (t, write, read, val) {
  let encoder = encoding.createEncoder()
  write(encoder, val)
  let reader = decoding.createDecoder(encoding.toBuffer(encoder))
  let result = read(reader)
  t.log(`string encode: ${JSON.stringify(val).length} bytes / binary encode: ${encoding.length(encoder)} bytes`)
  t.compare(val, result, 'Compare results')
}

const writeVarUint = (encoder, val) => encoding.writeVarUint(encoder, val)
const readVarUint = decoder => decoding.readVarUint(decoder)

test('varUint 1 byte', async function varUint1 (t) {
  testEncoding(t, writeVarUint, readVarUint, 42)
})

test('varUint 2 bytes', async function varUint2 (t) {
  testEncoding(t, writeVarUint, readVarUint, 1 << 9 | 3)
  testEncoding(t, writeVarUint, readVarUint, 1 << 9 | 3)
})
test('varUint 3 bytes', async function varUint3 (t) {
  testEncoding(t, writeVarUint, readVarUint, 1 << 17 | 1 << 9 | 3)
})

test('varUint 4 bytes', async function varUint4 (t) {
  testEncoding(t, writeVarUint, readVarUint, 1 << 25 | 1 << 17 | 1 << 9 | 3)
})

test('varUint of 2839012934', async function varUint2839012934 (t) {
  testEncoding(t, writeVarUint, readVarUint, 2839012934)
})

test('varUint random', async function varUintRandom (t) {
  const prng = random.createPRNG(t.getSeed() * Math.pow(Number.MAX_SAFE_INTEGER, 2))
  testEncoding(t, writeVarUint, readVarUint, random.int32(prng, 0, (1 << 28) - 1))
})

test('varUint random user id', async function varUintRandomUserId (t) {
  t.getSeed() // enforces that this test is repeated
  testEncoding(t, writeVarUint, readVarUint, generateRandomUint32())
})

const writeVarString = (encoder, val) => encoding.writeVarString(encoder, val)
const readVarString = decoder => decoding.readVarString(decoder)

test('varString', async function varString (t) {
  testEncoding(t, writeVarString, readVarString, 'hello')
  testEncoding(t, writeVarString, readVarString, 'test!')
  testEncoding(t, writeVarString, readVarString, '☺☺☺')
  testEncoding(t, writeVarString, readVarString, '1234')
  testEncoding(t, writeVarString, readVarString, '쾟')
  testEncoding(t, writeVarString, readVarString, '龟') // surrogate length 3
  testEncoding(t, writeVarString, readVarString, '😝') // surrogate length 4
})

test('varString random', async function varStringRandom (t) {
  const prng = random.createPRNG(t.getSeed() * 10000000)
  testEncoding(t, writeVarString, readVarString, random.utf16String(prng))
})
