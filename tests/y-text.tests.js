import * as Y from './testHelper.js'
import * as t from 'lib0/testing'
import * as prng from 'lib0/prng'
import * as math from 'lib0/math'

const { init, compare } = Y

/**
 * In this test we are mainly interested in the cleanup behavior and whether the resulting delta makes sense.
 * It is fine if the resulting delta is not minimal. But applying the delta to a rich-text editor should result in a
 * synced document.
 *
 * @param {t.TestCase} tc
 */
export const testDeltaAfterConcurrentFormatting = tc => {
  const { text0, text1, testConnector } = init(tc, { users: 2 })
  text0.insert(0, 'abcde')
  testConnector.flushAllMessages()
  text0.format(0, 3, { bold: true })
  text1.format(2, 2, { bold: true })
  /**
   * @type {any}
   */
  const deltas = []
  text1.observe(event => {
    if (event.delta.length > 0) {
      deltas.push(event.delta)
    }
  })
  testConnector.flushAllMessages()
  t.compare(deltas, [[{ retain: 3, attributes: { bold: true } }, { retain: 2, attributes: { bold: null } }]])
}

/**
 * @param {t.TestCase} tc
 */
export const testBasicInsertAndDelete = tc => {
  const { users, text0 } = init(tc, { users: 2 })
  let delta

  text0.observe(event => {
    delta = event.delta
  })

  text0.delete(0, 0)
  t.assert(true, 'Does not throw when deleting zero elements with position 0')

  text0.insert(0, 'abc')
  t.assert(text0.toString() === 'abc', 'Basic insert works')
  t.compare(delta, [{ insert: 'abc' }])

  text0.delete(0, 1)
  t.assert(text0.toString() === 'bc', 'Basic delete works (position 0)')
  t.compare(delta, [{ delete: 1 }])

  text0.delete(1, 1)
  t.assert(text0.toString() === 'b', 'Basic delete works (position 1)')
  t.compare(delta, [{ retain: 1 }, { delete: 1 }])

  users[0].transact(() => {
    text0.insert(0, '1')
    text0.delete(0, 1)
  })
  t.compare(delta, [])

  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testBasicFormat = tc => {
  const { users, text0 } = init(tc, { users: 2 })
  let delta
  text0.observe(event => {
    delta = event.delta
  })
  text0.insert(0, 'abc', { bold: true })
  t.assert(text0.toString() === 'abc', 'Basic insert with attributes works')
  t.compare(text0.toDelta(), [{ insert: 'abc', attributes: { bold: true } }])
  t.compare(delta, [{ insert: 'abc', attributes: { bold: true } }])
  text0.delete(0, 1)
  t.assert(text0.toString() === 'bc', 'Basic delete on formatted works (position 0)')
  t.compare(text0.toDelta(), [{ insert: 'bc', attributes: { bold: true } }])
  t.compare(delta, [{ delete: 1 }])
  text0.delete(1, 1)
  t.assert(text0.toString() === 'b', 'Basic delete works (position 1)')
  t.compare(text0.toDelta(), [{ insert: 'b', attributes: { bold: true } }])
  t.compare(delta, [{ retain: 1 }, { delete: 1 }])
  text0.insert(0, 'z', { bold: true })
  t.assert(text0.toString() === 'zb')
  t.compare(text0.toDelta(), [{ insert: 'zb', attributes: { bold: true } }])
  t.compare(delta, [{ insert: 'z', attributes: { bold: true } }])
  // @ts-ignore
  t.assert(text0._start.right.right.right.content.str === 'b', 'Does not insert duplicate attribute marker')
  text0.insert(0, 'y')
  t.assert(text0.toString() === 'yzb')
  t.compare(text0.toDelta(), [{ insert: 'y' }, { insert: 'zb', attributes: { bold: true } }])
  t.compare(delta, [{ insert: 'y' }])
  text0.format(0, 2, { bold: null })
  t.assert(text0.toString() === 'yzb')
  t.compare(text0.toDelta(), [{ insert: 'yz' }, { insert: 'b', attributes: { bold: true } }])
  t.compare(delta, [{ retain: 1 }, { retain: 1, attributes: { bold: null } }])
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testMultilineFormat = tc => {
  const ydoc = new Y.Doc()
  const testText = ydoc.getText('test')
  testText.insert(0, 'Test\nMulti-line\nFormatting')
  testText.applyDelta([
    { retain: 4, attributes: { bold: true } },
    { retain: 1 }, // newline character
    { retain: 10, attributes: { bold: true } },
    { retain: 1 }, // newline character
    { retain: 10, attributes: { bold: true } }
  ])
  t.compare(testText.toDelta(), [
    { insert: 'Test', attributes: { bold: true } },
    { insert: '\n' },
    { insert: 'Multi-line', attributes: { bold: true } },
    { insert: '\n' },
    { insert: 'Formatting', attributes: { bold: true } }
  ])
}

/**
 * @param {t.TestCase} tc
 */
export const testNotMergeEmptyLinesFormat = tc => {
  const ydoc = new Y.Doc()
  const testText = ydoc.getText('test')
  testText.applyDelta([
    { insert: 'Text' },
    { insert: '\n', attributes: { title: true } },
    { insert: '\nText' },
    { insert: '\n', attributes: { title: true } }
  ])
  t.compare(testText.toDelta(), [
    { insert: 'Text' },
    { insert: '\n', attributes: { title: true } },
    { insert: '\nText' },
    { insert: '\n', attributes: { title: true } }
  ])
}

/**
 * @param {t.TestCase} tc
 */
export const testPreserveAttributesThroughDelete = tc => {
  const ydoc = new Y.Doc()
  const testText = ydoc.getText('test')
  testText.applyDelta([
    { insert: 'Text' },
    { insert: '\n', attributes: { title: true } },
    { insert: '\n' }
  ])
  testText.applyDelta([
    { retain: 4 },
    { delete: 1 },
    { retain: 1, attributes: { title: true } }
  ])
  t.compare(testText.toDelta(), [
    { insert: 'Text' },
    { insert: '\n', attributes: { title: true } }
  ])
}

/**
 * @param {t.TestCase} tc
 */
export const testGetDeltaWithEmbeds = tc => {
  const { text0 } = init(tc, { users: 1 })
  text0.applyDelta([{
    insert: { linebreak: 's' }
  }])
  t.compare(text0.toDelta(), [{
    insert: { linebreak: 's' }
  }])
}

/**
 * @param {t.TestCase} tc
 */
export const testTypesAsEmbed = tc => {
  const { text0, text1, testConnector } = init(tc, { users: 2 })
  text0.applyDelta([{
    insert: new Y.Map([['key', 'val']])
  }])
  t.compare(text0.toDelta()[0].insert.toJSON(), { key: 'val' })
  let firedEvent = false
  text1.observe(event => {
    const d = event.delta
    t.assert(d.length === 1)
    t.compare(d.map(x => /** @type {Y.AbstractType<any>} */ (x.insert).toJSON()), [{ key: 'val' }])
    firedEvent = true
  })
  testConnector.flushAllMessages()
  const delta = text1.toDelta()
  t.assert(delta.length === 1)
  t.compare(delta[0].insert.toJSON(), { key: 'val' })
  t.assert(firedEvent, 'fired the event observer containing a Type-Embed')
}

/**
 * @param {t.TestCase} tc
 */
export const testSnapshot = tc => {
  const { text0 } = init(tc, { users: 1 })
  const doc0 = /** @type {Y.Doc} */ (text0.doc)
  doc0.gc = false
  text0.applyDelta([{
    insert: 'abcd'
  }])
  const snapshot1 = Y.snapshot(doc0)
  text0.applyDelta([{
    retain: 1
  }, {
    insert: 'x'
  }, {
    delete: 1
  }])
  const snapshot2 = Y.snapshot(doc0)
  text0.applyDelta([{
    retain: 2
  }, {
    delete: 3
  }, {
    insert: 'x'
  }, {
    delete: 1
  }])
  const state1 = text0.toDelta(snapshot1)
  t.compare(state1, [{ insert: 'abcd' }])
  const state2 = text0.toDelta(snapshot2)
  t.compare(state2, [{ insert: 'axcd' }])
  const state2Diff = text0.toDelta(snapshot2, snapshot1)
  // @ts-ignore Remove userid info
  state2Diff.forEach(v => {
    if (v.attributes && v.attributes.ychange) {
      delete v.attributes.ychange.user
    }
  })
  t.compare(state2Diff, [{ insert: 'a' }, { insert: 'x', attributes: { ychange: { type: 'added' } } }, { insert: 'b', attributes: { ychange: { type: 'removed' } } }, { insert: 'cd' }])
}

/**
 * @param {t.TestCase} tc
 */
export const testSnapshotDeleteAfter = tc => {
  const { text0 } = init(tc, { users: 1 })
  const doc0 = /** @type {Y.Doc} */ (text0.doc)
  doc0.gc = false
  text0.applyDelta([{
    insert: 'abcd'
  }])
  const snapshot1 = Y.snapshot(doc0)
  text0.applyDelta([{
    retain: 4
  }, {
    insert: 'e'
  }])
  const state1 = text0.toDelta(snapshot1)
  t.compare(state1, [{ insert: 'abcd' }])
}

/**
 * @param {t.TestCase} tc
 */
export const testToJson = tc => {
  const { text0 } = init(tc, { users: 1 })
  text0.insert(0, 'abc', { bold: true })
  t.assert(text0.toJSON() === 'abc', 'toJSON returns the unformatted text')
}

/**
 * @param {t.TestCase} tc
 */
export const testToDeltaEmbedAttributes = tc => {
  const { text0 } = init(tc, { users: 1 })
  text0.insert(0, 'ab', { bold: true })
  text0.insertEmbed(1, { image: 'imageSrc.png' }, { width: 100 })
  const delta0 = text0.toDelta()
  t.compare(delta0, [{ insert: 'a', attributes: { bold: true } }, { insert: { image: 'imageSrc.png' }, attributes: { width: 100 } }, { insert: 'b', attributes: { bold: true } }])
}

/**
 * @param {t.TestCase} tc
 */
export const testToDeltaEmbedNoAttributes = tc => {
  const { text0 } = init(tc, { users: 1 })
  text0.insert(0, 'ab', { bold: true })
  text0.insertEmbed(1, { image: 'imageSrc.png' })
  const delta0 = text0.toDelta()
  t.compare(delta0, [{ insert: 'a', attributes: { bold: true } }, { insert: { image: 'imageSrc.png' } }, { insert: 'b', attributes: { bold: true } }], 'toDelta does not set attributes key when no attributes are present')
}

/**
 * @param {t.TestCase} tc
 */
export const testFormattingRemoved = tc => {
  const { text0 } = init(tc, { users: 1 })
  text0.insert(0, 'ab', { bold: true })
  text0.delete(0, 2)
  t.assert(Y.getTypeChildren(text0).length === 1)
}

/**
 * @param {t.TestCase} tc
 */
export const testFormattingRemovedInMidText = tc => {
  const { text0 } = init(tc, { users: 1 })
  text0.insert(0, '1234')
  text0.insert(2, 'ab', { bold: true })
  text0.delete(2, 2)
  t.assert(Y.getTypeChildren(text0).length === 3)
}

/**
 * Reported in https://github.com/yjs/yjs/issues/344
 *
 * @param {t.TestCase} tc
 */
export const testFormattingDeltaUnnecessaryAttributeChange = tc => {
  const { text0, text1, testConnector } = init(tc, { users: 2 })
  text0.insert(0, '\n', {
    PARAGRAPH_STYLES: 'normal',
    LIST_STYLES: 'bullet'
  })
  text0.insert(1, 'abc', {
    PARAGRAPH_STYLES: 'normal'
  })
  testConnector.flushAllMessages()
  /**
   * @type {Array<any>}
   */
  const deltas = []
  text0.observe(event => {
    deltas.push(event.delta)
  })
  text1.observe(event => {
    deltas.push(event.delta)
  })
  text1.format(0, 1, { LIST_STYLES: 'number' })
  testConnector.flushAllMessages()
  const filteredDeltas = deltas.filter(d => d.length > 0)
  t.assert(filteredDeltas.length === 2)
  t.compare(filteredDeltas[0], [
    { retain: 1, attributes: { LIST_STYLES: 'number' } }
  ])
  t.compare(filteredDeltas[0], filteredDeltas[1])
}

/**
 * @param {t.TestCase} tc
 */
export const testInsertAndDeleteAtRandomPositions = tc => {
  const N = 100000
  const { text0 } = init(tc, { users: 1 })
  const gen = tc.prng

  // create initial content
  // let expectedResult = init
  text0.insert(0, prng.word(gen, N / 2, N / 2))

  // apply changes
  for (let i = 0; i < N; i++) {
    const pos = prng.uint32(gen, 0, text0.length)
    if (prng.bool(gen)) {
      const len = prng.uint32(gen, 1, 5)
      const word = prng.word(gen, 0, len)
      text0.insert(pos, word)
      // expectedResult = expectedResult.slice(0, pos) + word + expectedResult.slice(pos)
    } else {
      const len = prng.uint32(gen, 0, math.min(3, text0.length - pos))
      text0.delete(pos, len)
      // expectedResult = expectedResult.slice(0, pos) + expectedResult.slice(pos + len)
    }
  }
  // t.compareStrings(text0.toString(), expectedResult)
  t.describe('final length', '' + text0.length)
}

/**
 * @param {t.TestCase} tc
 */
export const testAppendChars = tc => {
  const N = 10000
  const { text0 } = init(tc, { users: 1 })

  // apply changes
  for (let i = 0; i < N; i++) {
    text0.insert(text0.length, 'a')
  }
  t.assert(text0.length === N)
}

const largeDocumentSize = 100000

const id = Y.createID(0, 0)
const c = new Y.ContentString('a')

/**
 * @param {t.TestCase} tc
 */
export const testBestCase = tc => {
  const N = largeDocumentSize
  const items = new Array(N)
  t.measureTime('time to create two million items in the best case', () => {
    const parent = /** @type {any} */ ({})
    let prevItem = null
    for (let i = 0; i < N; i++) {
      /**
       * @type {Y.Item}
       */
      const n = new Y.Item(Y.createID(0, 0), null, null, null, null, null, null, c)
      // items.push(n)
      items[i] = n
      n.right = prevItem
      n.rightOrigin = prevItem ? id : null
      n.content = c
      n.parent = parent
      prevItem = n
    }
  })
  const newArray = new Array(N)
  t.measureTime('time to copy two million items to new Array', () => {
    for (let i = 0; i < N; i++) {
      newArray[i] = items[i]
    }
  })
}

const tryGc = () => {
  // @ts-ignore
  if (typeof global !== 'undefined' && global.gc) {
    // @ts-ignore
    global.gc()
  }
}

/**
 * @param {t.TestCase} tc
 */
export const testLargeFragmentedDocument = tc => {
  const itemsToInsert = largeDocumentSize
  let update = /** @type {any} */ (null)
  ;(() => {
    const doc1 = new Y.Doc()
    const text0 = doc1.getText('txt')
    tryGc()
    t.measureTime(`time to insert ${itemsToInsert} items`, () => {
      doc1.transact(() => {
        for (let i = 0; i < itemsToInsert; i++) {
          text0.insert(0, '0')
        }
      })
    })
    tryGc()
    t.measureTime('time to encode document', () => {
      update = Y.encodeStateAsUpdateV2(doc1)
    })
    t.describe('Document size:', update.byteLength)
  })()
  ;(() => {
    const doc2 = new Y.Doc()
    tryGc()
    t.measureTime(`time to apply ${itemsToInsert} updates`, () => {
      Y.applyUpdateV2(doc2, update)
    })
  })()
}

/**
 * @param {t.TestCase} tc
 */
export const testIncrementalUpdatesPerformanceOnLargeFragmentedDocument = tc => {
  const itemsToInsert = largeDocumentSize
  const updates = /** @type {Array<Uint8Array>} */ ([])
  ;(() => {
    const doc1 = new Y.Doc()
    doc1.on('update', update => {
      updates.push(update)
    })
    const text0 = doc1.getText('txt')
    tryGc()
    t.measureTime(`time to insert ${itemsToInsert} items`, () => {
      doc1.transact(() => {
        for (let i = 0; i < itemsToInsert; i++) {
          text0.insert(0, '0')
        }
      })
    })
    tryGc()
  })()
  ;(() => {
    t.measureTime(`time to merge ${itemsToInsert} updates (differential updates)`, () => {
      Y.mergeUpdates(updates)
    })
    tryGc()
    t.measureTime(`time to merge ${itemsToInsert} updates (ydoc updates)`, () => {
      const ydoc = new Y.Doc()
      updates.forEach(update => {
        Y.applyUpdate(ydoc, update)
      })
    })
  })()
}

/**
 * Splitting surrogates can lead to invalid encoded documents.
 *
 * https://github.com/yjs/yjs/issues/248
 *
 * @param {t.TestCase} tc
 */
export const testSplitSurrogateCharacter = tc => {
  {
    const { users, text0 } = init(tc, { users: 2 })
    users[1].disconnect() // disconnecting forces the user to encode the split surrogate
    text0.insert(0, '👾') // insert surrogate character
    // split surrogate, which should not lead to an encoding error
    text0.insert(1, 'hi!')
    compare(users)
  }
  {
    const { users, text0 } = init(tc, { users: 2 })
    users[1].disconnect() // disconnecting forces the user to encode the split surrogate
    text0.insert(0, '👾👾') // insert surrogate character
    // partially delete surrogate
    text0.delete(1, 2)
    compare(users)
  }
  {
    const { users, text0 } = init(tc, { users: 2 })
    users[1].disconnect() // disconnecting forces the user to encode the split surrogate
    text0.insert(0, '👾👾') // insert surrogate character
    // formatting will also split surrogates
    text0.format(1, 2, { bold: true })
    compare(users)
  }
}

/**
 * Search marker bug https://github.com/yjs/yjs/issues/307
 *
 * @param {t.TestCase} tc
 */
export const testSearchMarkerBug1 = tc => {
  const { users, text0, text1, testConnector } = init(tc, { users: 2 })

  users[0].on('update', update => {
    users[0].transact(() => {
      Y.applyUpdate(users[0], update)
    })
  })
  users[0].on('update', update => {
    users[1].transact(() => {
      Y.applyUpdate(users[1], update)
    })
  })

  text0.insert(0, 'a_a')
  testConnector.flushAllMessages()
  text0.insert(2, 's')
  testConnector.flushAllMessages()
  text1.insert(3, 'd')
  testConnector.flushAllMessages()
  text0.delete(0, 5)
  testConnector.flushAllMessages()
  text0.insert(0, 'a_a')
  testConnector.flushAllMessages()
  text0.insert(2, 's')
  testConnector.flushAllMessages()
  text1.insert(3, 'd')
  testConnector.flushAllMessages()
  t.compareStrings(text0.toString(), text1.toString())
  t.compareStrings(text0.toString(), 'a_sda')
  compare(users)
}

/**
 * Reported in https://github.com/yjs/yjs/pull/32
 *
 * @param {t.TestCase} tc
 */
export const testFormattingBug = async tc => {
  const ydoc1 = new Y.Doc()
  const ydoc2 = new Y.Doc()
  const text1 = ydoc1.getText()
  text1.insert(0, '\n\n\n')
  text1.format(0, 3, { url: 'http://example.com' })
  ydoc1.getText().format(1, 1, { url: 'http://docs.yjs.dev' })
  ydoc2.getText().format(1, 1, { url: 'http://docs.yjs.dev' })
  Y.applyUpdate(ydoc2, Y.encodeStateAsUpdate(ydoc1))
  const text2 = ydoc2.getText()
  const expectedResult = [
    { insert: '\n', attributes: { url: 'http://example.com' } },
    { insert: '\n', attributes: { url: 'http://docs.yjs.dev' } },
    { insert: '\n', attributes: { url: 'http://example.com' } }
  ]
  t.compare(text1.toDelta(), expectedResult)
  t.compare(text1.toDelta(), text2.toDelta())
  console.log(text1.toDelta())
}

/**
 * Delete formatting should not leave redundant formatting items.
 *
 * @param {t.TestCase} tc
 */
export const testDeleteFormatting = tc => {
  const doc = new Y.Doc()
  const text = doc.getText()
  text.insert(0, 'Attack ships on fire off the shoulder of Orion.')

  const doc2 = new Y.Doc()
  const text2 = doc2.getText()
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc))

  text.format(13, 7, { bold: true })
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc))

  text.format(16, 4, { bold: null })
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc))

  const expected = [
    { insert: 'Attack ships ' },
    { insert: 'on ', attributes: { bold: true } },
    { insert: 'fire off the shoulder of Orion.' }
  ]
  t.compare(text.toDelta(), expected)
  t.compare(text2.toDelta(), expected)
}

// RANDOM TESTS

let charCounter = 0

/**
 * Random tests for pure text operations without formatting.
 *
 * @type Array<function(any,prng.PRNG):void>
 */
const textChanges = [
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // insert text
    const ytext = y.getText('text')
    const insertPos = prng.int32(gen, 0, ytext.length)
    const text = charCounter++ + prng.word(gen)
    const prevText = ytext.toString()
    ytext.insert(insertPos, text)
    t.compareStrings(ytext.toString(), prevText.slice(0, insertPos) + text + prevText.slice(insertPos))
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // delete text
    const ytext = y.getText('text')
    const contentLen = ytext.toString().length
    const insertPos = prng.int32(gen, 0, contentLen)
    const overwrite = math.min(prng.int32(gen, 0, contentLen - insertPos), 2)
    const prevText = ytext.toString()
    ytext.delete(insertPos, overwrite)
    t.compareStrings(ytext.toString(), prevText.slice(0, insertPos) + prevText.slice(insertPos + overwrite))
  }
]

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges5 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 5))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges30 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 30))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges40 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 40))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges50 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 50))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges70 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 70))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges90 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 90))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateTextChanges300 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, textChanges, 300))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

const marks = [
  { bold: true },
  { italic: true },
  { italic: true, color: '#888' }
]

const marksChoices = [
  undefined,
  ...marks
]

/**
 * Random tests for all features of y-text (formatting, embeds, ..).
 *
 * @type Array<function(any,prng.PRNG):void>
 */
const qChanges = [
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // insert text
    const ytext = y.getText('text')
    const insertPos = prng.int32(gen, 0, ytext.length)
    const attrs = prng.oneOf(gen, marksChoices)
    const text = charCounter++ + prng.word(gen)
    ytext.insert(insertPos, text, attrs)
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // insert embed
    const ytext = y.getText('text')
    const insertPos = prng.int32(gen, 0, ytext.length)
    if (prng.bool(gen)) {
      ytext.insertEmbed(insertPos, { image: 'https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png' })
    } else {
      ytext.insertEmbed(insertPos, new Y.Map([[prng.word(gen), prng.word(gen)]]))
    }
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // delete text
    const ytext = y.getText('text')
    const contentLen = ytext.toString().length
    const insertPos = prng.int32(gen, 0, contentLen)
    const overwrite = math.min(prng.int32(gen, 0, contentLen - insertPos), 2)
    ytext.delete(insertPos, overwrite)
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // format text
    const ytext = y.getText('text')
    const contentLen = ytext.toString().length
    const insertPos = prng.int32(gen, 0, contentLen)
    const overwrite = math.min(prng.int32(gen, 0, contentLen - insertPos), 2)
    const format = prng.oneOf(gen, marks)
    ytext.format(insertPos, overwrite, format)
  },
  /**
   * @param {Y.Doc} y
   * @param {prng.PRNG} gen
   */
  (y, gen) => { // insert codeblock
    const ytext = y.getText('text')
    const insertPos = prng.int32(gen, 0, ytext.toString().length)
    const text = charCounter++ + prng.word(gen)
    const ops = []
    if (insertPos > 0) {
      ops.push({ retain: insertPos })
    }
    ops.push({ insert: text }, { insert: '\n', format: { 'code-block': true } })
    ytext.applyDelta(ops)
  }
]

/**
 * @param {any} result
 */
const checkResult = result => {
  for (let i = 1; i < result.testObjects.length; i++) {
    /**
     * @param {any} d
     */
    const typeToObject = d => d.insert instanceof Y.AbstractType ? d.insert.toJSON() : d
    const p1 = result.users[i].getText('text').toDelta().map(typeToObject)
    const p2 = result.users[i].getText('text').toDelta().map(typeToObject)
    t.compare(p1, p2)
  }
  // Uncomment this to find formatting-cleanup issues
  // const cleanups = Y.cleanupYTextFormatting(result.users[0].getText('text'))
  // t.assert(cleanups === 0)
  return result
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges1 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, qChanges, 1))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges2 = tc => {
  const { users } = checkResult(Y.applyRandomTests(tc, qChanges, 2))
  const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
  t.assert(cleanups === 0)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges2Repeat = tc => {
  for (let i = 0; i < 1000; i++) {
    const { users } = checkResult(Y.applyRandomTests(tc, qChanges, 2))
    const cleanups = Y.cleanupYTextFormatting(users[0].getText('text'))
    t.assert(cleanups === 0)
  }
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges3 = tc => {
  checkResult(Y.applyRandomTests(tc, qChanges, 3))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges30 = tc => {
  checkResult(Y.applyRandomTests(tc, qChanges, 30))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges40 = tc => {
  checkResult(Y.applyRandomTests(tc, qChanges, 40))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges70 = tc => {
  checkResult(Y.applyRandomTests(tc, qChanges, 70))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges100 = tc => {
  checkResult(Y.applyRandomTests(tc, qChanges, 100))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGenerateQuillChanges300 = tc => {
  checkResult(Y.applyRandomTests(tc, qChanges, 300))
}
