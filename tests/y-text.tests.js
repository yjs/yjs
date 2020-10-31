import * as Y from './testHelper.js'
import * as t from 'lib0/testing.js'
import * as prng from 'lib0/prng.js'
import * as math from 'lib0/math.js'

const { init, compare } = Y

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
  if (typeof global !== 'undefined' && global.gc) {
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
    ytext.insertEmbed(insertPos, { image: 'https://user-images.githubusercontent.com/5553757/48975307-61efb100-f06d-11e8-9177-ee895e5916e5.png' })
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
    const p1 = result.users[i].getText('text').toDelta()
    const p2 = result.users[i].getText('text').toDelta()
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
