import * as logging from './logging.js'

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
