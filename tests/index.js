
import { runTests } from 'funlib/testing.js'
import * as deleteStore from './DeleteStore.tests.js'
import { isBrowser } from 'funlib/environment.js'
import * as log from 'funlib/logging.js'

if (isBrowser) {
  log.createVConsole(document.body)
}
runTests({ deleteStore })
