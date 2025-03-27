import * as t from 'lib0/testing'
import * as delta from '../src/utils/Delta.js'

/**
 * @param {t.TestCase} _tc
 */
export const testDelta = _tc => {
  const d = delta.create().insert('hello').insert(' ').useAttributes({ bold: true }).insert('world').useAttribution({ creator: 'tester' }).insert('!').done()
  t.compare(d.toJSON().ops, [{ insert: 'hello ' }, { insert: 'world', attributes: { bold: true } }, { insert: '!', attributes: { bold: true }, attribution: { creator: 'tester' } }])
}

