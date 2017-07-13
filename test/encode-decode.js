import { test } from 'cutest'
import Chance from 'chance'
import Y from '../src/y.js'
import { BinaryLength, BinaryEncoder, BinaryDecoder } from '../src/Encoding.js'

function testEncoding (t, write, read, val) {
  let binLength = new BinaryLength()
  write(binLength, val)
  let encoder = new BinaryEncoder(binLength)
  write(encoder, val)
  let reader = new BinaryDecoder(encoder.dataview)
  let result = read(reader)
  t.log(`string encode: ${JSON.stringify(val).length} bytes / binary encode: ${encoder.dataview.buffer.byteLength} bytes`)
  t.compare(val, result, 'Compare results')
}

const writeVarUint = (encoder, val) => encoder.writeVarUint(val)
const readVarUint = decoder => decoder.readVarUint()

test('varUint 1 byte', async function varUint1 (t) {
  testEncoding(t, writeVarUint, readVarUint, 42)
})

test('varUint 2 bytes', async function varUint2 (t) {
  testEncoding(t, writeVarUint, readVarUint, 1 << 9 | 3)
})
test('varUint 3 bytes', async function varUint3 (t) {
  testEncoding(t, writeVarUint, readVarUint, 1 << 17 | 1 << 9 | 3)
})

test('varUint 4 bytes', async function varUint4 (t) {
  testEncoding(t, writeVarUint, readVarUint, 1 << 25 | 1 << 17 | 1 << 9 | 3)
})

test('varUint random', async function varUintRandom (t) {
  const chance = new Chance(t.getSeed() * 1000000000)
  testEncoding(t, writeVarUint, readVarUint, chance.integer({min: 0, max: (1 << 28) - 1}))
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

const writeDelete = Y.Struct.Delete.binaryEncode
const readDelete = Y.Struct.Delete.binaryDecode

test('encode/decode Delete operation', async function binDelete (t) {
  let op = {
    target: [10, 3000],
    length: 40000,
    struct: 'Delete'
  }
  testEncoding(t, writeDelete, readDelete, op)
})

const writeInsert = Y.Struct.Insert.binaryEncode
const readInsert = Y.Struct.Insert.binaryDecode

test('encode/decode Insert operations', async function binInsert (t) {
  testEncoding(t, writeInsert, readInsert, {
    id: [1, 2],
    right: [5, 6],
    left: [3, 4],
    origin: [7, 8],
    parent: [9, 10],
    struct: 'Insert',
    content: ['a']
  })

  t.log('left === origin')
  testEncoding(t, writeInsert, readInsert, {
    id: [1, 2],
    right: [5, 6],
    left: [3, 4],
    origin: [3, 4],
    parent: [9, 10],
    struct: 'Insert',
    content: ['a']
  })

  t.log('parentsub')
  testEncoding(t, writeInsert, readInsert, {
    id: [1, 2],
    right: [5, 6],
    left: [3, 4],
    origin: [3, 4],
    parent: [9, 10],
    parentSub: 'sub',
    struct: 'Insert',
    content: ['a']
  })

  t.log('opContent')
  testEncoding(t, writeInsert, readInsert, {
    id: [1, 2],
    right: [5, 6],
    left: [3, 4],
    origin: [3, 4],
    parent: [9, 10],
    struct: 'Insert',
    opContent: [1000, 10000]
  })

  t.log('mixed content')
  testEncoding(t, writeInsert, readInsert, {
    id: [1, 2],
    right: [5, 6],
    left: [3, 4],
    origin: [3, 4],
    parent: [9, 10],
    struct: 'Insert',
    content: ['a', 1]
  })

  t.log('origin is null')
  testEncoding(t, writeInsert, readInsert, {
    id: [1, 2],
    right: [5, 6],
    left: [3, 4],
    origin: null,
    parent: [9, 10],
    struct: 'Insert',
    content: ['a']
  })

  t.log('left = origin = right = null')
  testEncoding(t, writeInsert, readInsert, {
    id: [1, 2],
    right: null,
    left: null,
    origin: null,
    parent: [9, 10],
    struct: 'Insert',
    content: ['a']
  })
})

const writeList = Y.Struct.List.binaryEncode
const readList = Y.Struct.List.binaryDecode

test('encode/decode List operations', async function binList (t) {
  testEncoding(t, writeList, readList, {
    struct: 'List',
    id: [100, 33],
    type: 'Array'
  })

  t.log('info is an object')
  testEncoding(t, writeList, readList, {
    struct: 'List',
    id: [100, 33],
    type: 'Array',
    info: { prop: 'yay' }
  })

  t.log('info is a string')
  testEncoding(t, writeList, readList, {
    struct: 'List',
    id: [100, 33],
    type: 'Array',
    info: 'hi'
  })

  t.log('info is a number')
  testEncoding(t, writeList, readList, {
    struct: 'List',
    id: [100, 33],
    type: 'Array',
    info: 400
  })
})

const writeMap = Y.Struct.Map.binaryEncode
const readMap = Y.Struct.Map.binaryDecode

test('encode/decode Map operations', async function binMap (t) {
  testEncoding(t, writeMap, readMap, {
    struct: 'Map',
    id: [100, 33],
    type: 'Map',
    map: {}
  })

  t.log('info is an object')
  testEncoding(t, writeMap, readMap, {
    struct: 'Map',
    id: [100, 33],
    type: 'Map',
    info: { prop: 'yay' },
    map: {}
  })

  t.log('info is a string')
  testEncoding(t, writeMap, readMap, {
    struct: 'Map',
    id: [100, 33],
    type: 'Map',
    map: {},
    info: 'hi'
  })

  t.log('info is a number')
  testEncoding(t, writeMap, readMap, {
    struct: 'Map',
    id: [100, 33],
    type: 'Map',
    map: {},
    info: 400
  })
})
