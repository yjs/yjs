/**
 * @module testing
 */

import * as logging from './logging.js'
import { simpleDiff } from './diff.js'

export const run = async (name, f) => {
  console.log(`%cStart:%c   ${name}`, 'color:blue;', '')
  const start = new Date()
  try {
    await f(name)
  } catch (e) {
    logging.print(`%cFailure:%c ${name} in %c${new Date().getTime() - start.getTime()}ms`, 'color:red;font-weight:bold', '', 'color:grey')
    throw e
  }
  logging.print(`%cSuccess:%c ${name} in %c${new Date().getTime() - start.getTime()}ms`, 'color:green;font-weight:bold', '', 'color:grey')
}

export const compareArrays = (as, bs) => {
  if (as.length !== bs.length) {
    return false
  }
  for (let i = 0; i < as.length; i++) {
    if (as[i] !== bs[i]) {
      return false
    }
  }
  return true
}

export const compareStrings = (a, b) => {
  if (a !== b) {
    const diff = simpleDiff(a, b)
    logging.print(`%c${a.slice(0, diff.pos)}%c${a.slice(diff.pos, diff.remove)}%c${diff.insert}%c${a.slice(diff.pos + diff.remove)}`, 'color:grey', 'color:red', 'color:green', 'color:grey')
  }
}
