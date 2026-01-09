import * as Y from '../src/index.js'
import { init, compare } from './testHelper.js'
import * as t from 'lib0/testing'
import * as delta from 'lib0/delta'

export const testCustomTypings = () => {
  const ydoc = new Y.Doc()
  const ymap = ydoc.get()
  /**
   * @type {Y.Type<{ attrs: { num: number, str: string, [k:string]: number|string } }>}
   */
  const yxml = ymap.setAttr('yxml', new Y.Type('test'))
  /**
   * @type {number|undefined}
   */
  const num = yxml.getAttr('num')
  /**
   * @type {string|undefined}
   */
  const str = yxml.getAttr('str')
  /**
   * @type {object|number|string|undefined}
   */
  const dtrn = yxml.getAttr('dtrn')
  const attrs = yxml.getAttrs()
  /**
   * @type {object|number|string|undefined}
   */
  const any = attrs.shouldBeAny
  console.log({ num, str, dtrn, attrs, any })
}

/**
 * @param {t.TestCase} tc
 */
export const testSetProperty = tc => {
  const { testConnector, users, xml0, xml1 } = init(tc, { users: 2 })
  xml0.setAttr('height', '10')
  t.assert(xml0.getAttr('height') === '10', 'Simple set+get works')
  testConnector.flushAllMessages()
  t.assert(xml1.getAttr('height') === '10', 'Simple set+get works (remote)')
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testHasProperty = tc => {
  const { testConnector, users, xml0, xml1 } = init(tc, { users: 2 })
  xml0.setAttr('height', '10')
  t.assert(xml0.hasAttr('height'), 'Simple set+has works')
  testConnector.flushAllMessages()
  t.assert(xml1.hasAttr('height'), 'Simple set+has works (remote)')
  xml0.deleteAttr('height')
  t.assert(!xml0.hasAttr('height'), 'Simple set+remove+has works')
  testConnector.flushAllMessages()
  t.assert(!xml1.hasAttr('height'), 'Simple set+remove+has works (remote)')
  compare(users)
}

/**
 * @param {t.TestCase} _tc
 */
export const testYtextAttributes = _tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get('')
  ytext.observe(event => {
    t.assert(event.delta.attrs.test?.type === 'insert')
  })
  ytext.setAttr('test', 42)
  t.compare(ytext.getAttr('test'), 42)
  t.compare(ytext.getAttrs(), { test: 42 })
}

/**
 * @param {t.TestCase} _tc
 */
export const testSiblings = _tc => {
  const ydoc = new Y.Doc()
  const yxml = ydoc.get()
  const first = new Y.Type()
  const second = new Y.Type('p')
  yxml.insert(0, [first, second])
  t.assert(first.parent === /** @type {Y.AbstractType<any>} */ (yxml))
  t.assert(yxml.parent === null)
}

/**
 * @param {t.TestCase} _tc
 */
export const testInsertafter = _tc => {
  const ydoc = new Y.Doc()
  const yxml = ydoc.get()
  const first = new Y.Type()
  const second = new Y.Type('p')
  const third = new Y.Type('p')

  const deepsecond1 = new Y.Type('span')
  const deepsecond2 = new Y.Type()
  second.insertAfter(null, [deepsecond1])
  second.insertAfter(deepsecond1, [deepsecond2])

  yxml.insertAfter(null, [first, second])
  yxml.insertAfter(second, [third])

  t.assert(yxml.length === 3)
  t.assert(second.get(0) === deepsecond1)
  t.assert(second.get(1) === deepsecond2)

  t.compareArrays(yxml.toArray(), [first, second, third])

  t.fails(() => {
    const el = new Y.Type('p')
    el.insertAfter(deepsecond1, [new Y.Type()])
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testClone = _tc => {
  const ydoc = new Y.Doc()
  const yxml = ydoc.get()
  const first = new Y.Type('text')
  const second = new Y.Type('p')
  const third = new Y.Type('p')
  yxml.push([first, second, third])
  t.compareArrays(yxml.toArray(), [first, second, third])
  const cloneYxml = yxml.clone()
  ydoc.get('copyarr').insert(0, [cloneYxml])
  t.assert(cloneYxml.length === 3)
  t.compare(cloneYxml.toJSON(), yxml.toJSON())
}

/**
 * @param {t.TestCase} _tc
 */
export const testFormattingBug = _tc => {
  const ydoc = new Y.Doc()
  const yxml = ydoc.get()
  const q = delta.create()
    .insert('A', { em: {}, strong: {} })
    .insert('B', { em: {} })
    .insert('C', { em: {}, strong: {} })
  yxml.applyDelta(q)
  t.compare(yxml.getContent(), q)
}

/**
 * @param {t.TestCase} _tc
 */
export const testElement = _tc => {
  const ydoc = new Y.Doc()
  const yxmlel = ydoc.get()
  const text1 = new Y.Type('text1')
  const text2 = new Y.Type('text2')
  yxmlel.insert(0, [text1, text2])
  t.compareArrays(yxmlel.toArray(), [text1, text2])
}

/**
 * @param {t.TestCase} _tc
 */
export const testFragmentAttributedContent = _tc => {
  const ydoc = new Y.Doc({ gc: false })
  const yfragment = new Y.Type()
  const elem1 = new Y.Type('hello')
  const elem2 = new Y.Type()
  const elem3 = new Y.Type('world')
  yfragment.insert(0, [elem1, elem2])
  ydoc.get().insert(0, [yfragment])
  let attributionManager = Y.noAttributionsManager
  ydoc.on('afterTransaction', tr => {
    // attributionManager = new TwosetAttributionManager(createIdMapFromIdSet(tr.insertSet, [new Y.Attribution('insertedAt', 42), new Y.Attribution('insert', 'kevin')]), createIdMapFromIdSet(tr.deleteSet, [new Y.Attribution('delete', 'kevin')]))
    attributionManager = new Y.TwosetAttributionManager(Y.createIdMapFromIdSet(tr.insertSet, []), Y.createIdMapFromIdSet(tr.deleteSet, []))
  })
  t.group('insert / delete', () => {
    ydoc.transact(() => {
      yfragment.delete(0, 1)
      yfragment.insert(1, [elem3])
    })
    const expectedContent = delta.create().insert([elem1], null, { delete: [] }).insert([elem2]).insert([elem3], null, { insert: [] })
    const attributedContent = yfragment.getContent(attributionManager)
    console.log(attributedContent.toJSON())
    t.assert(attributedContent.equals(expectedContent))
    t.compare(elem1.getContent(attributionManager).toJSON(), delta.create().insert('hello', null, { delete: [] }).toJSON())
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testElementAttributedContent = _tc => {
  const ydoc = new Y.Doc({ gc: false })
  const yelement = ydoc.get('p')
  const elem1 = delta.create().insert('hello').done()
  const elem2 = delta.create('span').done()
  const elem3 = delta.create().insert('world').done()
  yelement.insert(0, [elem1, elem2])
  let attributionManager = Y.noAttributionsManager
  ydoc.on('afterTransaction', tr => {
    // attributionManager = new TwosetAttributionManager(createIdMapFromIdSet(tr.insertSet, [new Y.Attribution('insertedAt', 42), new Y.Attribution('insert', 'kevin')]), createIdMapFromIdSet(tr.deleteSet, [new Y.Attribution('delete', 'kevin')]))
    attributionManager = new Y.TwosetAttributionManager(Y.createIdMapFromIdSet(tr.insertSet, []), Y.createIdMapFromIdSet(tr.deleteSet, []))
  })
  t.group('insert / delete', () => {
    ydoc.transact(() => {
      yelement.delete(0, 1)
      yelement.insert(1, [elem3])
      yelement.setAttr('key', '42')
    })
    const expectedContent = delta.create()
      .insert([delta.create().insert('hello', null, { delete: [] })], null, { delete: [] })
      .insert([elem2])
      .insert([delta.create().insert('world', null, { insert: [] })], null, { insert: [] })
      .setAttr('key', '42', { insert: [] })
    const attributedContent = yelement.getContentDeep(attributionManager)
    console.log('retrieved content', attributedContent.toJSON())
    t.assert(attributedContent.equals(expectedContent))
    t.compare(attributedContent.toJSON().attrs, { key: { type: 'insert', value: '42', attribution: { insert: [] } } })
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testElementAttributedContentViaDiffer = _tc => {
  const ydocV1 = new Y.Doc()
  ydocV1.get('p').insert(0, [delta.create().insert('hello'), delta.create('span')])
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(ydocV1))
  const yelement = ydoc.get('p')
  const elem2 = yelement.get(1) // new Y.XmlElement('span')
  const elem3 = new Y.Type('world')
  ydoc.transact(() => {
    yelement.delete(0, 1)
    yelement.insert(1, [elem3])
    yelement.setAttr('key', '42')
  })
  const attributionManager = Y.createAttributionManagerFromDiff(ydocV1, ydoc)
  const expectedContent = delta.create().insert([delta.create().insert('hello')], null, { delete: [] }).insert([elem2.getContentDeep()]).insert([delta.create().insert('world', null, { insert: [] })], null, { insert: [] }).setAttr('key', '42', { insert: [] })
  const attributedContent = yelement.getContentDeep(attributionManager)
  console.log('children', attributedContent.toJSON().children)
  console.log('attributes', attributedContent.toJSON().attrs)
  t.compare(attributedContent.toJSON(), expectedContent.toJSON())
  t.assert(attributedContent.equals(expectedContent))
  t.compare(attributedContent.toJSON().attrs, { key: { type: 'insert', value: '42', attribution: { insert: [] } } })
  t.group('test getContentDeep', () => {
    const expectedContent = delta.create()
      .insert(
        [delta.create().insert('hello')],
        null,
        { delete: [] }
      )
      .insert([delta.create('span')])
      .insert([
        delta.create().insert('world', null, { insert: [] })
      ], null, { insert: [] })
      .setAttr('key', '42', { insert: [] })
    const attributedContent = yelement.getContentDeep(attributionManager)
    console.log('children', JSON.stringify(attributedContent.toJSON().children, null, 2))
    console.log('cs expec', JSON.stringify(expectedContent.toJSON(), null, 2))
    console.log('attributes', attributedContent.toJSON().attrs)
    t.assert(attributedContent.equals(expectedContent))
    t.compare(attributedContent.toJSON().attrs, { key: { type: 'insert', value: '42', attribution: { insert: [] } } })
    t.assert(attributedContent.name === null)
  })
  ydoc.transact(() => {
    elem3.insert(0, 'big')
  })
  t.group('test getContentDeep after some more updates', () => {
    t.info('expecting diffingAttributionManager to auto update itself')
    const expectedContent = delta.create()
      .insert(
        [delta.create().insert('hello')],
        null,
        { delete: [] }
      )
      .insert([delta.create('span')])
      .insert([
        delta.create().insert('bigworld', null, { insert: [] })
      ], null, { insert: [] })
      .setAttr('key', '42', { insert: [] })
    const attributedContent = yelement.getContentDeep(attributionManager)
    console.log('children', JSON.stringify(attributedContent.toJSON().children, null, 2))
    console.log('cs expec', JSON.stringify(expectedContent.toJSON(), null, 2))
    console.log('attributes', attributedContent.toJSON().attrs)
    t.assert(attributedContent.equals(expectedContent))
    t.compare(attributedContent.toJSON().attrs, { key: { type: 'insert', value: '42', attribution: { insert: [] } } })
    t.assert(attributedContent.name === null)
  })
  Y.applyUpdate(ydocV1, Y.encodeStateAsUpdate(ydoc))
  t.group('test getContentDeep both docs synced', () => {
    t.info('expecting diffingAttributionManager to auto update itself')
    const expectedContent = delta.create().insert([delta.create('span')]).insert([
      delta.create().insert('bigworld')
    ]).setAttr('key', '42')
    const attributedContent = yelement.getContentDeep(attributionManager)
    console.log('children', JSON.stringify(attributedContent.toJSON().children, null, 2))
    console.log('cs expec', JSON.stringify(expectedContent.toJSON(), null, 2))
    console.log('attributes', attributedContent.toJSON().attrs)
    t.assert(attributedContent.equals(expectedContent))
    t.compare(attributedContent.toJSON().attrs, { key: { type: 'insert', value: '42' } })
    t.assert(attributedContent.name === null)
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testAttributionManagerSimpleExample = _tc => {
  const ydoc = new Y.Doc()
  ydoc.clientID = 0
  // create some initial content
  ydoc.get().insert(0, [delta.create().insert('hello world')])
  const ydocFork = new Y.Doc()
  ydocFork.clientID = 1
  Y.applyUpdate(ydocFork, Y.encodeStateAsUpdate(ydoc))
  // modify the fork
  // append a span element
  ydocFork.get().insert(1, [new Y.Type('span')])
  const ytext = ydocFork.get().get(0)
  // make "hello" italic
  ytext.format(0, 5, { italic: true })
  ytext.insert(11, 'deleteme')
  ytext.delete(11, 8)
  ytext.insert(11, '!')
  // highlight the changes
  console.log(JSON.stringify(ydocFork.get().getContentDeep(Y.createAttributionManagerFromDiff(ydoc, ydocFork)), null, 2))
/* =>
{
  "children": {
    "ops": [
      {
        "insert": [
          {
            "ops": [
              {
                "insert": "hello",
                "attributes": {
                  "italic": true
                },
                "attribution": {
                  "attributes": {
                    "italic": []     -- the attribute "italic" was changed
                  }
                }
              },
              {
                "insert": " world"   -- "world" remains unchanged
              },
              {
                "insert": "!",
                "attribution": {
                  "insert": []       -- "!" was inserted
                }
              }
            ]
          }
        ]
      },
      {
        "insert": [
          {
            "nodeName": "span",
            "children": {
              "ops": []
            },
            "attributes": {}
          }
        ],
        "attribution": {
          "insert": []               -- A <span/> tag was inserted
        }
      }
    ]
  }
}
*/
}
