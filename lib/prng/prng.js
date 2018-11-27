/**
 * @module prng
 */

import * as binary from '../binary.js'
import { fromCharCode, fromCodePoint } from '../string.js'
import { MAX_SAFE_INTEGER, MIN_SAFE_INTEGER } from '../number.js'
import * as math from '../math.js'

import { Xoroshiro128plus as DefaultPRNG } from './PRNG/Xoroshiro128plus.js'

/**
 * Description of the function
 *  @callback generatorNext
 *  @return {number} A 32bit integer
 */

/**
 * A random type generator.
 *
 * @typedef {Object} PRNG
 * @property {generatorNext} next Generate new number
 */

/**
 * Create a Xoroshiro128plus Pseudo-Random-Number-Generator.
 * This is the fastest full-period generator passing BigCrush without systematic failures.
 * But there are more PRNGs available in ./PRNG/.
 *
 * @param {number} seed A positive 32bit integer. Do not use negative numbers.
 * @return {PRNG}
 */
export const createPRNG = seed => new DefaultPRNG(Math.floor(seed < 1 ? seed * binary.BITS32 : seed))

/**
 * Generates a single random bool.
 *
 * @param {PRNG} gen A random number generator.
 * @return {Boolean} A random boolean
 */
export const bool = gen => (gen.next() & 2) === 2 // brackets are non-optional!

/**
 * Generates a random integer with 53 bit resolution.
 *
 * @param {PRNG} gen A random number generator.
 * @param {Number} [min = MIN_SAFE_INTEGER] The lower bound of the allowed return values (inclusive).
 * @param {Number} [max = MAX_SAFE_INTEGER] The upper bound of the allowed return values (inclusive).
 * @return {Number} A random integer on [min, max]
 */
export const int53 = (gen, min = MIN_SAFE_INTEGER, max = MAX_SAFE_INTEGER) => math.floor(real53(gen) * (max + 1 - min) + min)

/**
 * Generates a random integer with 32 bit resolution.
 *
 * @param {PRNG} gen A random number generator.
 * @param {Number} [min = MIN_SAFE_INTEGER] The lower bound of the allowed return values (inclusive).
 * @param {Number} [max = MAX_SAFE_INTEGER] The upper bound of the allowed return values (inclusive).
 * @return {Number} A random integer on [min, max]
 */
export const int32 = (gen, min = MIN_SAFE_INTEGER, max = MAX_SAFE_INTEGER) => min + ((gen.next() >>> 0) % (max + 1 - min))

/**
 * Generates a random real on [0, 1) with 32 bit resolution.
 *
 * @param {PRNG} gen A random number generator.
 * @return {Number} A random real number on [0, 1).
 */
export const real32 = gen => (gen.next() >>> 0) / binary.BITS32

/**
 * Generates a random real on [0, 1) with 53 bit resolution.
 *
 * @param {PRNG} gen A random number generator.
 * @return {Number} A random real number on [0, 1).
 */
export const real53 = gen => (((gen.next() >>> 5) * binary.BIT26) + (gen.next() >>> 6)) / MAX_SAFE_INTEGER

/**
 * Generates a random character from char code 32 - 126. I.e. Characters, Numbers, special characters, and Space:
 *
 * (Space)!"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[/]^_`abcdefghijklmnopqrstuvwxyz{|}~
 */
export const char = gen => fromCharCode(int32(gen, 32, 126))

/**
 * @param {PRNG} gen
 * @return {string} A single letter (a-z)
 */
export const letter = gen => fromCharCode(int32(gen, 97, 122))

/**
 * @param {PRNG} gen
 * @return {string} A random word without spaces consisting of letters (a-z)
 */
export const word = gen => {
  const len = int32(gen, 0, 20)
  let str = ''
  for (let i = 0; i < len; i++) {
    str += letter(gen)
  }
  return str
}

/**
 * TODO: this function produces invalid runes. Does not cover all of utf16!!
 */
export const utf16Rune = gen => {
  const codepoint = int32(gen, 0, 256)
  return fromCodePoint(codepoint)
}

/**
 * @param {PRNG} gen
 * @param {number} [maxlen = 20]
 */
export const utf16String = (gen, maxlen = 20) => {
  const len = int32(gen, 0, maxlen)
  let str = ''
  for (let i = 0; i < len; i++) {
    str += utf16Rune(gen)
  }
  return str
}

/**
 * Returns one element of a given array.
 *
 * @param {PRNG} gen A random number generator.
 * @param {Array<T>} array Non empty Array of possible values.
 * @return {T} One of the values of the supplied Array.
 * @template T
 */
export const oneOf = (gen, array) => array[int32(gen, 0, array.length - 1)]
