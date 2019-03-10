
import { runTests } from 'lib0/testing.js'
import { isBrowser } from 'lib0/environment.js'
import * as log from 'lib0/logging.js'
import * as deleteStore from './DeleteStore.tests.js'
import * as array from './y-array.tests.js'

if (isBrowser) {
  log.createVConsole(document.body)
}
runTests({ deleteStore, array })
