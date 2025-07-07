import * as t from 'lib0/testing'
import * as delta from '../src/utils/Delta.js'
import * as Y from 'yjs'

/**
 * @param {t.TestCase} _tc
 */
export const testDelta = _tc => {
  const d = delta.createTextDelta().insert('hello').insert(' ').useAttributes({ bold: true }).insert('world').useAttribution({ insert: ['tester'] }).insert('!').done()
  t.compare(d.toJSON(), [{ insert: 'hello ' }, { insert: 'world', attributes: { bold: true } }, { insert: '!', attributes: { bold: true }, attribution: { insert: ['tester'] } }])
}

/**
 * @param {t.TestCase} _tc
 */
export const testDeltaMerging = _tc => {
  const d = delta.createTextDelta()
    .insert('hello')
    .insert('world')
    .insert(' ', { italic: true })
    .insert({})
    .insert([1])
    .insert([2])
    .done()
  t.compare(d.toJSON(), [{ insert: 'helloworld' }, { insert: ' ', attributes: { italic: true } }, { insert: {} }, { insert: [1, 2] }])
}

/**
 * @param {t.TestCase} _tc
 */
export const testUseAttributes = _tc => {
  const d = delta.createTextDelta()
    .insert('a')
    .updateUsedAttributes('bold', true)
    .insert('b')
    .insert('c', { bold: 4 })
    .updateUsedAttributes('bold', null)
    .insert('d')
    .useAttributes({ italic: true })
    .insert('e')
    .useAttributes(null)
    .insert('f')
    .done()
  const d2 = delta.createTextDelta()
    .insert('a')
    .insert('b', { bold: true })
    .insert('c', { bold: 4 })
    .insert('d')
    .insert('e', { italic: true })
    .insert('f')
    .done()
  t.compare(d, d2)
}

/**
 * @param {t.TestCase} _tc
 */
export const testUseAttribution = _tc => {
  const d = delta.createTextDelta()
    .insert('a')
    .updateUsedAttribution('insert', ['me'])
    .insert('b')
    .insert('c', null, { insert: ['you'] })
    .updateUsedAttribution('insert', null)
    .insert('d')
    .useAttribution({ insert: ['me'] })
    .insert('e')
    .useAttribution(null)
    .insert('f')
    .done()
  const d2 = delta.createTextDelta()
    .insert('a')
    .insert('b', null, { insert: ['me'] })
    .insert('c', null, { insert: ['you'] })
    .insert('d')
    .insert('e', null, { insert: ['me'] })
    .insert('f')
    .done()
  t.compare(d, d2)
}

/**
 * @param {t.TestCase} _tc
 */
export const testMapDelta = _tc => {
  const d = /** @type {delta.MapDeltaBuilder<{ key: string, v: number, over: string }>} */ (delta.createMapDelta())
  d.set('key', 'value')
    .useAttribution({ delete: ['me'] })
    .delete('v', 94)
    .useAttribution(null)
    .set('over', 'writeme', 'i existed before')
    .set('over', 'andout')
    .done()
  t.compare(d.toJSON(), {
    key: { type: 'insert', value: 'value', prevValue: undefined, attribution: null },
    v: { type: 'delete', value: undefined, prevValue: 94, attribution: { delete: ['me'] } },
    over: { type: 'insert', value: 'andout', prevValue: 'i existed before', attribution: null }
  })
  t.compare(d.origin, null)
  t.compare(d.remote, false)
  t.compare(d.isDiff, true)
  d.forEach((change, key) => {
    if (key === 'v') {
      t.assert(d.get(key)?.prevValue === 94) // should know that value is number
      t.assert(change.prevValue === 94)
    } else if (key === 'key') {
      t.assert(d.get(key)?.value === 'value') // show know that value is a string
      t.assert(change.value === 'value')
    } else if (key === 'over') {
      t.assert(change.value === 'andout')
    } else {
      throw new Error()
    }
  })
  for (const [key, change] of d) {
    if (key === 'v') {
      t.assert(d.get(key)?.prevValue === 94)
      t.assert(change.prevValue === 94) // should know that value is number
    } else if (key === 'key') {
      t.assert(change.value === 'value') // should know that value is number
    } else if (key === 'over') {
      t.assert(change.value === 'andout')
    } else {
      throw new Error()
    }
  }
}

/**
 * @param {t.TestCase} _tc
 */
export const testXmlDelta = _tc => {
  const d = /** @type {delta.XmlDelta<string, string, { a: 1 }>} */ (delta.createXmlDelta())
  d.children.insert(['hi'])
  d.attributes.set('a', 1)
  d.attributes.delete('a', 1)
  /**
   * @type {Array<Array<string>| number>}
   */
  const arr = []
  d.children.forEach(
    (op, index) => {
      if (op instanceof delta.InsertArrayOp) {
        arr.push(op.insert, index)
      }
    },
    (op, index) => {
      arr.push(op.insert, index)
    },
    (op, index) => {
      arr.push(op.retain)
    },
    (op, index) => {
      arr.push(op.delete)
    }
  )
  t.compare(arr, [['hi'], 0, ['hi'], 0])
  const x = d.done()
  console.log(x)
}

/**
 * @param {t.TestCase} tc
 */
export const testTextModifyingDelta = tc => {
  const d = /** @type {delta.TextDelta<Y.Map<any>|Y.Array<any>>} */ (delta.createTextDelta()).insert('hi').insert(new Y.Map()).done()
  console.log(d)
}
