/**
 * @module prng
 */

/**
 *TODO: enable tests
import * as rt from '../rich-text/formatters.js''
import { test } from '../test/test.js''
import Xoroshiro128plus from './PRNG/Xoroshiro128plus.js''
import Xorshift32 from './PRNG/Xorshift32.js''
import MT19937 from './PRNG/Mt19937.js''
import { generateBool, generateInt, generateInt32, generateReal, generateChar } from './random.js''
import { MAX_SAFE_INTEGER } from '../number/constants.js''
import { BIT32 } from '../binary/constants.js''

function init (Gen) {
  return {
    gen: new Gen(1234)
  }
}

const PRNGs = [
  { name: 'Xoroshiro128plus', Gen: Xoroshiro128plus },
  { name: 'Xorshift32', Gen: Xorshift32 },
  { name: 'MT19937', Gen: MT19937 }
]

const ITERATONS = 1000000

for (const PRNG of PRNGs) {
  const prefix = rt.orange`${PRNG.name}:`

  test(rt.plain`${prefix} generateBool`, function generateBoolTest (t) {
    const { gen } = init(PRNG.Gen)
    let head = 0
    let tail = 0
    let b
    let i

    for (i = 0; i < ITERATONS; i++) {
      b = generateBool(gen)
      if (b) {
        head++
      } else {
        tail++
      }
    }
    t.log(`Generated ${head} heads and ${tail} tails.`)
    t.assert(tail >= Math.floor(ITERATONS * 0.49), 'Generated enough tails.')
    t.assert(head >= Math.floor(ITERATONS * 0.49), 'Generated enough heads.')
  })

  test(rt.plain`${prefix} generateInt integers average correctly`, function averageIntTest (t) {
    const { gen } = init(PRNG.Gen)
    let count = 0
    let i

    for (i = 0; i < ITERATONS; i++) {
      count += generateInt(gen, 0, 100)
    }
    const average = count / ITERATONS
    const expectedAverage = 100 / 2
    t.log(`Average is: ${average}. Expected average is ${expectedAverage}.`)
    t.assert(Math.abs(average - expectedAverage) <= 1, 'Expected average is at most 1 off.')
  })

  test(rt.plain`${prefix} generateInt32 generates integer with 32 bits`, function generateLargeIntegers (t) {
    const { gen } = init(PRNG.Gen)
    let num = 0
    let i
    let newNum
    for (i = 0; i < ITERATONS; i++) {
      newNum = generateInt32(gen, 0, MAX_SAFE_INTEGER)
      if (newNum > num) {
        num = newNum
      }
    }
    t.log(`Largest number generated is ${num} (0b${num.toString(2)})`)
    t.assert(num > (BIT32 >>> 0), 'Largest number is 32 bits long.')
  })

  test(rt.plain`${prefix} generateReal has 53 bit resolution`, function real53bitResolution (t) {
    const { gen } = init(PRNG.Gen)
    let num = 0
    let i
    let newNum
    for (i = 0; i < ITERATONS; i++) {
      newNum = generateReal(gen) * MAX_SAFE_INTEGER
      if (newNum > num) {
        num = newNum
      }
    }
    t.log(`Largest number generated is ${num}.`)
    t.assert((MAX_SAFE_INTEGER - num) / MAX_SAFE_INTEGER < 0.01, 'Largest number is close to MAX_SAFE_INTEGER (at most 1% off).')
  })

  test(rt.plain`${prefix} generateChar generates all described characters`, function real53bitResolution (t) {
    const { gen } = init(PRNG.Gen)
    const charSet = new Set()
    const chars = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[/]^_`abcdefghijklmnopqrstuvwxyz{|}~"'
    let i
    let char
    for (i = chars.length - 1; i >= 0; i--) {
      charSet.add(chars[i])
    }
    for (i = 0; i < ITERATONS; i++) {
      char = generateChar(gen)
      charSet.delete(char)
    }
    t.log(`Charactes missing: ${charSet.size} - generating all of "${chars}"`)
    t.assert(charSet.size === 0, 'Generated all documented characters.')
  })
}
*/
