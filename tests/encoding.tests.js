import * as t from 'lib0/testing'
import * as promise from 'lib0/promise'

import {
  contentRefs,
  readContentBinary,
  readContentDeleted,
  readContentString,
  readContentJSON,
  readContentEmbed,
  readContentType,
  readContentFormat,
  readContentAny,
  readContentDoc,
  Doc,
  PermanentUserData,
  encodeStateAsUpdate,
  applyUpdate
} from '../src/internals.js'

import * as Y from '../src/index.js'

/**
 * @param {t.TestCase} tc
 */
export const testStructReferences = tc => {
  t.assert(contentRefs.length === 11)
  t.assert(contentRefs[1] === readContentDeleted)
  t.assert(contentRefs[2] === readContentJSON) // TODO: deprecate content json?
  t.assert(contentRefs[3] === readContentBinary)
  t.assert(contentRefs[4] === readContentString)
  t.assert(contentRefs[5] === readContentEmbed)
  t.assert(contentRefs[6] === readContentFormat)
  t.assert(contentRefs[7] === readContentType)
  t.assert(contentRefs[8] === readContentAny)
  t.assert(contentRefs[9] === readContentDoc)
  // contentRefs[10] is reserved for Skip structs
}

/**
 * There is some custom encoding/decoding happening in PermanentUserData.
 * This is why it landed here.
 *
 * @param {t.TestCase} tc
 */
export const testPermanentUserData = async tc => {
  const ydoc1 = new Doc()
  const ydoc2 = new Doc()
  const pd1 = new PermanentUserData(ydoc1)
  const pd2 = new PermanentUserData(ydoc2)
  pd1.setUserMapping(ydoc1, ydoc1.clientID, 'user a')
  pd2.setUserMapping(ydoc2, ydoc2.clientID, 'user b')
  ydoc1.getText().insert(0, 'xhi')
  ydoc1.getText().delete(0, 1)
  ydoc2.getText().insert(0, 'hxxi')
  ydoc2.getText().delete(1, 2)
  await promise.wait(10)
  applyUpdate(ydoc2, encodeStateAsUpdate(ydoc1))
  applyUpdate(ydoc1, encodeStateAsUpdate(ydoc2))

  // now sync a third doc with same name as doc1 and then create PermanentUserData
  const ydoc3 = new Doc()
  applyUpdate(ydoc3, encodeStateAsUpdate(ydoc1))
  const pd3 = new PermanentUserData(ydoc3)
  pd3.setUserMapping(ydoc3, ydoc3.clientID, 'user a')
}

/**
 * Reported here: https://github.com/yjs/yjs/issues/308
 * @param {t.TestCase} tc
 */
export const testDiffStateVectorOfUpdateIsEmpty = tc => {
  const ydoc = new Y.Doc()
  /**
   * @type {any}
   */
  let sv = null
  ydoc.getText().insert(0, 'a')
  ydoc.on('update', update => {
    sv = Y.encodeStateVectorFromUpdate(update)
  })
  // should produce an update with an empty state vector (because previous ops are missing)
  ydoc.getText().insert(0, 'a')
  t.assert(sv !== null && sv.byteLength === 1 && sv[0] === 0)
}

/**
 * Reported here: https://github.com/yjs/yjs/issues/308
 * @param {t.TestCase} tc
 */
export const testDiffStateVectorOfUpdateIgnoresSkips = tc => {
  const ydoc = new Y.Doc()
  /**
   * @type {Array<Uint8Array>}
   */
  const updates = []
  ydoc.on('update', update => {
    updates.push(update)
  })
  ydoc.getText().insert(0, 'a')
  ydoc.getText().insert(0, 'b')
  ydoc.getText().insert(0, 'c')
  const update13 = Y.mergeUpdates([updates[0], updates[2]])
  const sv = Y.encodeStateVectorFromUpdate(update13)
  const state = Y.decodeStateVector(sv)
  t.assert(state.get(ydoc.clientID) === 1)
  t.assert(state.size === 1)
}

/** @function
  * @param {number} x
  */
const splitClocksBy = (x) => {
  /**
    * @param {number} _client
    * @param {number} clock
    * @param {number} maxClock
    */
  return function * (_client, clock, maxClock) {
    while (clock < maxClock) {
      clock = Math.min(clock + x, maxClock)
      clock = yield clock
    }
  }
}

/**
 * @param {t.TestCase} tc
 */
export const testEncodeStateAsUpdatesWithOneClient = tc => {
  const yDoc = new Y.Doc()
  const yText = yDoc.getText('textBlock')
  yText.applyDelta([{ insert: 'r' }])
  yText.applyDelta([{ insert: 'o' }])
  yText.applyDelta([{ insert: 'n' }])
  yText.applyDelta([{ insert: 'e' }])
  yText.applyDelta([{ insert: 'n' }])

  const updates = Array.from(Y.encodeStateAsStreamOfUpdates(yDoc, { clockSplits: splitClocksBy(1) }))

  const yDocToAssert = new Y.Doc()
  updates.forEach((update) => {
    Y.applyUpdate(yDocToAssert, update)
  })
  t.compareStrings(yDocToAssert.getText('textBlock').toString(), 'nenor')

  // yDoc did 5 updates
  // 1 (empty) delete set
  t.compare(6, updates.length)
}

/**
 * @param {t.TestCase} tc
 */
export const testEncodeStateAsUpdatesWithTwoClients = tc => {
  // Arrange
  const yDoc = new Y.Doc()
  const yText = yDoc.getText('textBlock')
  yText.applyDelta([{ insert: 'r' }])
  yText.applyDelta([{ insert: 'o' }])
  yText.applyDelta([{ insert: 'n' }])

  const remoteDoc = new Y.Doc()
  Y.applyUpdate(remoteDoc, Y.encodeStateAsUpdate(yDoc))

  remoteDoc.getText('textBlock').applyDelta([{ insert: 'e' }])

  Y.applyUpdate(yDoc, Y.encodeStateAsUpdate(remoteDoc))
  yText.applyDelta([{ insert: 'n' }])

  // Act
  const updates = Array.from(Y.encodeStateAsStreamOfUpdates(yDoc, { clockSplits: splitClocksBy(1) }))

  // Assert
  const yDocToAssert = new Y.Doc()
  updates.forEach((update) => {
    Y.applyUpdate(yDocToAssert, update)
  })
  t.compareStrings(yDocToAssert.getText('textBlock').toString(), 'nenor')

  // yDoc did 3+1=4 updates
  // remoteDoc did 1 update
  // 1 (empty) delete set
  t.compare(6, updates.length)
}

/**
 * @param {t.TestCase} tc
 */
export const testEncodeStateAsUpdatesWithItemsOfLength2 = tc => {
  // Arrange
  const yDoc = new Y.Doc()
  const yText = yDoc.getText('textBlock')
  yText.applyDelta([{ insert: 'or' }])
  yText.applyDelta([{ insert: 'n' }])
  yText.applyDelta([{ insert: 'ne' }])

  // Act
  const updates = Array.from(Y.encodeStateAsStreamOfUpdates(yDoc, { clockSplits: splitClocksBy(1) }))

  // Assert
  // yDoc did 3 updates (ne will keep together, even if we use clockSplit of 1)
  // 1 (empty) delete set
  t.compare(3 + 1, updates.length)

  const yDocToAssert = new Y.Doc()

  Y.applyUpdate(yDocToAssert, updates[0]) // delete set
  t.compareStrings(yDocToAssert.getText('textBlock').toString(), '')
  t.compare(Y.getState(yDocToAssert.store, yDoc.clientID), 0)

  Y.applyUpdate(yDocToAssert, updates[1]) // delete set
  t.compareStrings(yDocToAssert.getText('textBlock').toString(), 'or')
  t.compare(Y.getState(yDocToAssert.store, yDoc.clientID), 2)

  Y.applyUpdate(yDocToAssert, updates[2]) // delete set
  t.compareStrings(yDocToAssert.getText('textBlock').toString(), 'nor')
  t.compare(Y.getState(yDocToAssert.store, yDoc.clientID), 3)

  Y.applyUpdate(yDocToAssert, updates[3]) // delete set
  t.compareStrings(yDocToAssert.getText('textBlock').toString(), 'nenor')
  t.compare(Y.getState(yDocToAssert.store, yDoc.clientID), 5)
}

/**
 * @param {t.TestCase} tc
 */
export const testEncodeStateAsUpdatesWithBadClockSplits = tc => {
  const yDoc = new Y.Doc()
  const yText = yDoc.getText('textBlock')
  yText.applyDelta([{ insert: 'r' }])
  yText.applyDelta([{ insert: 'o' }])
  yText.applyDelta([{ insert: 'n' }])
  yText.applyDelta([{ insert: 'e' }])
  yText.applyDelta([{ insert: 'n' }])

  const updates = Array.from(Y.encodeStateAsStreamOfUpdates(yDoc, {
    clockSplits: function * (_client, clock, maxClock) {
      clock = yield clock - 1
      clock = yield clock + 1 // first message
      clock = yield clock
      clock = yield clock
      clock = yield clock
      clock = yield clock + 1 // second message
      clock = yield maxClock + 100 // last message
    }
  }))

  const yDocToAssert = new Y.Doc()

  // Delete set message
  Y.applyUpdate(yDocToAssert, updates[0])
  t.compareStrings(yDocToAssert.getText('textBlock').toString(), '')

  // first message
  Y.applyUpdate(yDocToAssert, updates[1])
  t.compareStrings(yDocToAssert.getText('textBlock').toString(), 'r')

  // second message
  Y.applyUpdate(yDocToAssert, updates[2])
  t.compareStrings(yDocToAssert.getText('textBlock').toString(), 'or')

  Y.applyUpdate(yDocToAssert, updates[3])
  t.compareStrings(yDocToAssert.getText('textBlock').toString(), 'nenor')

  t.compare(4, updates.length)
}

/**
 * @param {t.TestCase} tc
 */
export const testEncodeStateAsUpdatesShouldRespectClockSplits = tc => {
  // Arrange
  const yDoc = new Y.Doc()
  /**
   * @type {Array<number>}
   */
  const clockSplits = []
  /**
   * @type {Array<Uint8Array>}
   */
  const expectedUpdates = []
  yDoc.on('update', (update) => {
    clockSplits.push(Y.getState(yDoc.store, yDoc.clientID))
    expectedUpdates.push(update)
  })
  const cells = yDoc.getArray('cells')

  const cell0 = new Y.Map()
  cell0.set('id', new Y.Text('zero'))
  cell0.set('source', new Y.Text('# Hello World'))
  cells.push([cell0])

  const cell1 = new Y.Map()
  cell1.set('id', new Y.Text('one'))
  cell1.set('source', new Y.Text('import pandas as pd'))
  cells.push([cell1])

  yDoc.transact(() => {
    yDoc.getMap('meta').set('language', 'python')
    yDoc.getMap('state').set('version', 3)
  })

  // Act
  const streamOfUpdates = Y.encodeStateAsStreamOfUpdates(yDoc, {
    clockSplits: () => clockSplits
  })

  // Assert
  const yDocToAssert = new Y.Doc()
  let i = -1
  for (const update of streamOfUpdates) {
    Y.applyUpdate(yDocToAssert, update)
    if (i >= 0) { // i == -1 is the delete set message
      t.compare(update, expectedUpdates[i], 'updates match')
      t.compare(Y.getState(yDocToAssert.store, yDoc.clientID), clockSplits[i], 'correct clock afterwards')
    }
    i++
  }
  t.compare(yDocToAssert.getArray('cells').toJSON(), [
    { id: 'zero', source: '# Hello World' },
    { id: 'one', source: 'import pandas as pd' }

  ])
  t.compare(yDocToAssert.getMap('meta').toJSON(), { language: 'python' })
  t.compare(yDocToAssert.getMap('state').toJSON(), { version: 3 })
}

/**
 * @param {t.TestCase} tc
 */
export const testEncodeStateAsUpdatesWithMaps = tc => {
  // Arrange
  const yDoc = new Y.Doc()
  const yMap = yDoc.getMap('myMap')
  yMap.set('foo', 'foo1')
  yMap.set('bar', 'bar1')
  yMap.set('quux', 'quux1')

  yMap.set('bar', 'bar2')

  const expectedMap = {
    foo: 'foo1',
    bar: 'bar2',
    quux: 'quux1'
  }

  // Act
  const updates = Array.from(Y.encodeStateAsStreamOfUpdates(yDoc, {
    clockSplits: splitClocksBy(2)
  }))

  // Assert
  t.compare(3, updates.length)

  const yDocToAssert = new Y.Doc()

  // Delete set message
  Y.applyUpdate(yDocToAssert, updates[0])
  t.compare(10, updates[0].length) // There is a delete set!
  t.compare(0, updates[0][0]) // No updates by clients
  t.compareObjects(yDocToAssert.getMap('myMap').toJSON(), {}, 'after update 1')

  // First 2 updates
  Y.applyUpdate(yDocToAssert, updates[1])
  // bar is not here because the item is in the delete set
  t.compareObjects(yDocToAssert.getMap('myMap').toJSON(), { foo: 'foo1' }, 'after update 2')

  // Last 2 updates
  Y.applyUpdate(yDocToAssert, updates[2])
  t.compareObjects(yDocToAssert.getMap('myMap').toJSON(), { foo: 'foo1', bar: 'bar2', quux: 'quux1' }, 'after update 3')

  t.compareObjects(yDocToAssert.getMap('myMap').toJSON(), expectedMap)
}

/**
 * @param {t.TestCase} tc
 */
export const testEncodeStateAsUpdatesWithDifferentSortingAndEditsByClients = tc => {
  // Arrange
  const yNotebook = new Y.Doc()

  /**
   * @type {Array<number>}
   */
  const clockSplits = []
  yNotebook.on('update', (update) => {
    clockSplits.push(Y.getState(yNotebook.store, yNotebook.clientID))
  })
  const cells = yNotebook.getArray('cells')

  const cell0 = new Y.Map()
  cell0.set('id', new Y.Text('zero'))
  cell0.set('source', new Y.Text('# Hello World'))
  cells.push([cell0])

  const cell1 = new Y.Map()
  cell1.set('id', new Y.Text('one'))
  cell1.set('source', new Y.Text('import pandas as pd'))
  cells.push([cell1])

  const cell2 = new Y.Map()
  cell2.set('id', new Y.Text('two'))
  cell2.set('source', new Y.Text('# Conclusion'))
  cells.push([cell2])

  yNotebook.transact(() => {
    yNotebook.getMap('meta').set('language', 'python')
    yNotebook.getMap('state').set('version', 3)
  })

  const clientDoc = new Y.Doc()
  Y.applyUpdate(clientDoc, Y.encodeStateAsUpdate(yNotebook))
  const source = clientDoc.getArray('cells').get(1).get('source')
  source.insert(source.length, '\nimport random')
  t.compare(source.toString(), 'import pandas as pd\nimport random', 'clientDoc should have right code')

  Y.applyUpdate(yNotebook, Y.encodeStateAsUpdate(clientDoc))

  console.log('clockSplits', clockSplits, yNotebook.clientID)
  const updates = Array.from(Y.encodeStateAsStreamOfUpdates(yNotebook, {
    clockSplits: (client) => {
      if (client === yNotebook.clientID) {
        return clockSplits
      }
      return []
    },
    sortClients: clientClocks => {
      return [
        ...clientClocks.filter(([client]) => client === clientDoc.clientID),
        ...clientClocks.filter(([client]) => client === yNotebook.clientID)
      ]
    }
  }))

  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, updates[0]) // delete set
  t.compare(ydoc.getArray('cells').toJSON(), [])

  Y.applyUpdate(ydoc, updates[1]) // clientDoc updates
  t.compare(ydoc.getArray('cells').toJSON(), [])

  Y.applyUpdate(ydoc, updates[2]) // cell 0 initialized
  t.compare(ydoc.getArray('cells').toJSON(), [{ id: 'zero', source: '# Hello World' }])

  Y.applyUpdate(ydoc, updates[3]) // cell 1 initialized, immediately applies edits by clients
  t.compare(ydoc.getArray('cells').toJSON(), [
    { id: 'zero', source: '# Hello World' },
    { id: 'one', source: 'import pandas as pd\nimport random' }
  ])

  Y.applyUpdate(ydoc, updates[4]) // cell 2 initialized
  t.compare(ydoc.getArray('cells').toJSON(), [
    { id: 'zero', source: '# Hello World' },
    { id: 'one', source: 'import pandas as pd\nimport random' },
    { id: 'two', source: '# Conclusion' }
  ])

  Y.applyUpdate(ydoc, updates[5]) // metadata
  t.compare(ydoc.getArray('cells').toJSON(), [
    { id: 'zero', source: '# Hello World' },
    { id: 'one', source: 'import pandas as pd\nimport random' },
    { id: 'two', source: '# Conclusion' }
  ])

  t.compare(6, updates.length)
}
