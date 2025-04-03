/* eslint-env node */

import * as map from './y-map.tests.js'
import * as array from './y-array.tests.js'
import * as text from './y-text.tests.js'
import * as xml from './y-xml.tests.js'
import * as encoding from './encoding.tests.js'
import * as undoredo from './undo-redo.tests.js'
import * as compatibility from './compatibility.tests.js'
import * as doc from './doc.tests.js'
import * as snapshot from './snapshot.tests.js'
import * as updates from './updates.tests.js'
import * as relativePositions from './relativePositions.tests.js'

import { runTests } from 'lib0/testing'
import { isBrowser, isNode } from 'lib0/environment'
import * as log from 'lib0/logging'
import { environment } from 'lib0'

if (isBrowser) {
  log.createVConsole(document.body)
}

/**
 * @type {any}
 */
const tests = {
  doc, map, array, text, xml, encoding, undoredo, compatibility, snapshot, updates, relativePositions
}

const run = async () => {
  if (environment.isNode) {
    // tests.nodejs = await import('./node.tests.js')
  }

  const success = await runTests(tests)
  /* istanbul ignore next */
  if (isNode) {
    process.exit(success ? 0 : 1)
  }
}
run()
