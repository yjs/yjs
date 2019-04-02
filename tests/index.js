
import { runTests } from 'lib0/testing.js'
import { isBrowser } from 'lib0/environment.js'
import * as log from 'lib0/logging.js'
import * as array from './y-array.tests.js'
import * as map from './y-map.tests.js'
import * as text from './y-text.tests.js'
import * as xml from './y-xml.tests.js'

if (isBrowser) {
  log.createVConsole(document.body)
}
runTests({ map, array, text, xml })
