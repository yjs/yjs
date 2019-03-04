
import { runTests } from 'funlib/testing.js'
import { isBrowser } from 'funlib/environment.js'
import * as log from 'funlib/logging.js'
import * as deleteStoreTest from './DeleteStore.tests.js'
import * as arrayTest from './y-array.tests.js'

if (isBrowser) {
  log.createVConsole(document.body)
}
runTests({ deleteStoreTest, arrayTest })
