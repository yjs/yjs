/**
 * @module prng
 */

import { Mt19937 } from './Mt19937.js'
import { Xoroshiro128plus } from './Xoroshiro128plus.js'
import { Xorshift32 } from './Xorshift32.js'
import * as time from '../../time.js'

const DIAMETER = 300
const NUMBERS = 10000

const runPRNG = (name, Gen) => {
  console.log('== ' + name + ' ==')
  const gen = new Gen(1234)
  let head = 0
  let tails = 0
  const date = time.getUnixTime()
  const canvas = document.createElement('canvas')
  canvas.height = DIAMETER
  canvas.width = DIAMETER
  const ctx = canvas.getContext('2d')
  const vals = new Set()
  ctx.fillStyle = 'blue'
  for (let i = 0; i < NUMBERS; i++) {
    const n = gen.next() & 0xFFFFFF
    const x = (gen.next() >>> 0) % DIAMETER
    const y = (gen.next() >>> 0) % DIAMETER
    ctx.fillRect(x, y, 1, 2)
    if ((n & 1) === 1) {
      head++
    } else {
      tails++
    }
    if (vals.has(n)) {
      console.warn(`The generator generated a duplicate`)
    }
    vals.add(n)
  }
  console.log('time: ', time.getUnixTime() - date)
  console.log('head:', head, 'tails:', tails)
  console.log('%c       ', `font-size: 200px; background: url(${canvas.toDataURL()}) no-repeat;`)
  const h1 = document.createElement('h1')
  h1.insertBefore(document.createTextNode(name), null)
  document.body.insertBefore(h1, null)
  document.body.appendChild(canvas)
}

runPRNG('mt19937', Mt19937)
runPRNG('xoroshiro128plus', Xoroshiro128plus)
runPRNG('xorshift32', Xorshift32)
