import { test } from '../node_modules/cutest/cutest.mjs'
import '../node_modules/chance/chance.js'
import BinaryEncoder from '../src/Binary/Encoder.js'
import BinaryDecoder from '../src/Binary/Decoder.js'
import { generateUserID } from '../src/Util/generateUserID.js'
import Chance from 'chance'

function testEncoding (t, write, read, val) {
  let encoder = new BinaryEncoder()
  write(encoder, val)
  let reader = new BinaryDecoder(encoder.createBuffer())
  let result = read(reader)
  t.log(`string encode: ${JSON.stringify(val).length} bytes / binary encode: ${encoder.data.length} bytes`)
  t.compare(val, result, 'Compare results')
}

const writeVarUint = (encoder, val) => encoder.writeVarUint(val)
const readVarUint = decoder => decoder.readVarUint()

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
  const chance = new Chance(t.getSeed() * Math.pow(Number.MAX_SAFE_INTEGER))
  testEncoding(t, writeVarUint, readVarUint, chance.integer({min: 0, max: (1 << 28) - 1}))
})

test('varUint random user id', async function varUintRandomUserId (t) {
  t.getSeed() // enforces that this test is repeated
  testEncoding(t, writeVarUint, readVarUint, generateUserID())
})

const writeVarString = (encoder, val) => encoder.writeVarString(val)
const readVarString = decoder => decoder.readVarString()

test('varString', async function varString (t) {
  testEncoding(t, writeVarString, readVarString, 'hello')
  testEncoding(t, writeVarString, readVarString, 'test!')
  testEncoding(t, writeVarString, readVarString, '☺☺☺')
  testEncoding(t, writeVarString, readVarString, '1234')
})

test('varString random', async function varStringRandom (t) {
  const chance = new Chance(t.getSeed() * 1000000000)
  testEncoding(t, writeVarString, readVarString, chance.string())
})
