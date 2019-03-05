
import { runTests } from 'funlib/testing.js'
import { isBrowser } from 'funlib/environment.js'
import * as log from 'funlib/logging.js'
import * as deleteStore from './DeleteStore.tests.js'
import * as array from './y-array.tests.js'

if (isBrowser) {
  log.createVConsole(document.body)
}
runTests({ deleteStore, array })
