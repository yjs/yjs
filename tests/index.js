
import * as map from './y-map.tests.js'
import * as array from './y-array.tests.js'
import * as text from './y-text.tests.js'
import * as xml from './y-xml.tests.js'
import * as encoding from './encoding.tests.js'
import * as undoredo from './undo-redo.tests.js'
import * as compatibility from './compatibility.tests.js'
import * as doc from './doc.tests.js'
import * as snapshot from './snapshot.tests.js'

import { runTests } from 'lib0/testing.js'
import { isBrowser, isNode } from 'lib0/environment.js'
import * as log from 'lib0/logging.js'

if (isBrowser) {
  log.createVConsole(document.body)
}
runTests({
  doc, map, array, text, xml, encoding, undoredo, compatibility, snapshot
}).then(success => {
  /* istanbul ignore next */
  if (isNode) {
    process.exit(success ? 0 : 1)
  }
})
