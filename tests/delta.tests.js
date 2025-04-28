import * as t from 'lib0/testing'
import * as delta from '../src/utils/Delta.js'

/**
 * @param {t.TestCase} _tc
 */
export const testDelta = _tc => {
  const d = delta.create().insert('hello').insert(' ').useAttributes({ bold: true }).insert('world').useAttribution({ insert: ['tester'] }).insert('!').done()
  t.compare(d.toJSON().ops, [{ insert: 'hello ' }, { insert: 'world', attributes: { bold: true } }, { insert: '!', attributes: { bold: true }, attribution: { insert: ['tester'] } }])
}

/**
 * @param {t.TestCase} _tc
 */
export const testDeltaMerging = _tc => {
  const d = delta.create()
    .insert('hello')
    .insert('world')
    .insert(' ', { italic: true })
    .insert({})
    .insert([1])
    .insert([2])
    .done()
  t.compare(d.toJSON().ops, [{ insert: 'helloworld' }, { insert: ' ', attributes: { italic: true } }, { insert: {} }, { insert: [1, 2] }])
}
