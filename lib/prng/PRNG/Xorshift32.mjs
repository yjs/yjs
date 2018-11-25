/**
 * @module prng
 */

/**
 * Xorshift32 is a very simple but elegang PRNG with a period of `2^32-1`.
 */
export class Xorshift32 {
  /**
   * @param {number} seed The starting point for the random number generation. If you use the same seed, the generator will return the same sequence of random numbers.
   */
  constructor (seed) {
    this.seed = seed
    this._state = seed
  }
  /**
   * Generate a random signed integer.
   *
   * @return {Number} A 32 bit signed integer.
   */
  next () {
    let x = this._state
    x ^= x << 13
    x ^= x >> 17
    x ^= x << 5
    this._state = x
    return x
  }
}
