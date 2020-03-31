import * as Y from './testHelper.js'
import * as t from 'lib0/testing.js'
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
  text0.insertEmbed(0, { image: 'imageSrc.png' }, { width: 100 })
  const [delta0] = text0.toDelta();
  t.assert(!!delta0.attributes, 'toDelta correctly reads attributes')
  const { text0: text1 } = init(tc, { users: 1 })
  text1.insertEmbed(1, { image: 'imageSrc.png' })
  const [delta1] = text1.toDelta();
  t.assert(!delta1.hasOwnProperty('attributes'), 'toDelta does not set attributes key when no attributes are present')
}
