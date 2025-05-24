import * as Y from '../src/index.js'
import { init, compare } from './testHelper.js'
import * as t from 'lib0/testing'
import * as delta from '../src/utils/Delta.js'

export const testCustomTypings = () => {
  const ydoc = new Y.Doc()
  const ymap = ydoc.getMap()
  /**
   * @type {Y.XmlElement<{ num: number, str: string, [k:string]: object|number|string }>}
   */
  const yxml = ymap.set('yxml', new Y.XmlElement('test'))
  /**
   * @type {number|undefined}
   */
  const num = yxml.getAttribute('num')
  /**
   * @type {string|undefined}
   */
  const str = yxml.getAttribute('str')
  /**
   * @type {object|number|string|undefined}
   */
  const dtrn = yxml.getAttribute('dtrn')
  const attrs = yxml.getAttributes()
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
  xml0.setAttribute('height', '10')
  t.assert(xml0.getAttribute('height') === '10', 'Simple set+get works')
  testConnector.flushAllMessages()
  t.assert(xml1.getAttribute('height') === '10', 'Simple set+get works (remote)')
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testHasProperty = tc => {
  const { testConnector, users, xml0, xml1 } = init(tc, { users: 2 })
  xml0.setAttribute('height', '10')
  t.assert(xml0.hasAttribute('height'), 'Simple set+has works')
  testConnector.flushAllMessages()
  t.assert(xml1.hasAttribute('height'), 'Simple set+has works (remote)')

  xml0.removeAttribute('height')
  t.assert(!xml0.hasAttribute('height'), 'Simple set+remove+has works')
  testConnector.flushAllMessages()
  t.assert(!xml1.hasAttribute('height'), 'Simple set+remove+has works (remote)')
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testEvents = tc => {
  const { testConnector, users, xml0, xml1 } = init(tc, { users: 2 })
  /**
   * @type {any}
   */
  let event
  /**
   * @type {any}
   */
  let remoteEvent
  xml0.observe(e => {
    event = e
  })
  xml1.observe(e => {
    remoteEvent = e
  })
  xml0.setAttribute('key', 'value')
  t.assert(event.attributesChanged.has('key'), 'YXmlEvent.attributesChanged on updated key')
  testConnector.flushAllMessages()
  t.assert(remoteEvent.attributesChanged.has('key'), 'YXmlEvent.attributesChanged on updated key (remote)')
  // check attributeRemoved
  xml0.removeAttribute('key')
  t.assert(event.attributesChanged.has('key'), 'YXmlEvent.attributesChanged on removed attribute')
  testConnector.flushAllMessages()
  t.assert(remoteEvent.attributesChanged.has('key'), 'YXmlEvent.attributesChanged on removed attribute (remote)')
  xml0.insert(0, [new Y.XmlText('some text')])
  t.assert(event.childListChanged, 'YXmlEvent.childListChanged on inserted element')
  testConnector.flushAllMessages()
  t.assert(remoteEvent.childListChanged, 'YXmlEvent.childListChanged on inserted element (remote)')
  // test childRemoved
  xml0.delete(0)
  t.assert(event.childListChanged, 'YXmlEvent.childListChanged on deleted element')
  testConnector.flushAllMessages()
  t.assert(remoteEvent.childListChanged, 'YXmlEvent.childListChanged on deleted element (remote)')
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testTreewalker = tc => {
  const { users, xml0 } = init(tc, { users: 3 })
  const paragraph1 = new Y.XmlElement('p')
  const paragraph2 = new Y.XmlElement('p')
  const text1 = new Y.XmlText('init')
  const text2 = new Y.XmlText('text')
  paragraph1.insert(0, [text1, text2])
  xml0.insert(0, [paragraph1, paragraph2, new Y.XmlElement('img')])
  const allParagraphs = xml0.querySelectorAll('p')
  t.assert(allParagraphs.length === 2, 'found exactly two paragraphs')
  t.assert(allParagraphs[0] === paragraph1, 'querySelectorAll found paragraph1')
  t.assert(allParagraphs[1] === paragraph2, 'querySelectorAll found paragraph2')
  t.assert(xml0.querySelector('p') === paragraph1, 'querySelector found paragraph1')
  compare(users)
}

/**
 * @param {t.TestCase} _tc
 */
export const testYtextAttributes = _tc => {
  const ydoc = new Y.Doc()
  const ytext = /** @type {Y.XmlText} */ (ydoc.get('', Y.XmlText))
  ytext.observe(event => {
    t.compare(event.changes.keys.get('test'), { action: 'add', oldValue: undefined })
  })
  ytext.setAttribute('test', 42)
  t.compare(ytext.getAttribute('test'), 42)
  t.compare(ytext.getAttributes(), { test: 42 })
}

/**
 * @param {t.TestCase} _tc
 */
export const testSiblings = _tc => {
  const ydoc = new Y.Doc()
  const yxml = ydoc.getXmlFragment()
  const first = new Y.XmlText()
  const second = new Y.XmlElement('p')
  yxml.insert(0, [first, second])
  t.assert(first.nextSibling === second)
  t.assert(second.prevSibling === first)
  t.assert(first.parent === yxml)
  t.assert(yxml.parent === null)
  t.assert(yxml.firstChild === first)
}

/**
 * @param {t.TestCase} _tc
 */
export const testInsertafter = _tc => {
  const ydoc = new Y.Doc()
  const yxml = ydoc.getXmlFragment()
  const first = new Y.XmlText()
  const second = new Y.XmlElement('p')
  const third = new Y.XmlElement('p')

  const deepsecond1 = new Y.XmlElement('span')
  const deepsecond2 = new Y.XmlText()
  second.insertAfter(null, [deepsecond1])
  second.insertAfter(deepsecond1, [deepsecond2])

  yxml.insertAfter(null, [first, second])
  yxml.insertAfter(second, [third])

  t.assert(yxml.length === 3)
  t.assert(second.get(0) === deepsecond1)
  t.assert(second.get(1) === deepsecond2)

  t.compareArrays(yxml.toArray(), [first, second, third])

  t.fails(() => {
    const el = new Y.XmlElement('p')
    el.insertAfter(deepsecond1, [new Y.XmlText()])
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testClone = _tc => {
  const ydoc = new Y.Doc()
  const yxml = ydoc.getXmlFragment()
  const first = new Y.XmlText('text')
  const second = new Y.XmlElement('p')
  const third = new Y.XmlElement('p')
  yxml.push([first, second, third])
  t.compareArrays(yxml.toArray(), [first, second, third])
  const cloneYxml = yxml.clone()
  ydoc.getArray('copyarr').insert(0, [cloneYxml])
  t.assert(cloneYxml.length === 3)
  t.compare(cloneYxml.toJSON(), yxml.toJSON())
}

/**
 * @param {t.TestCase} _tc
 */
export const testFormattingBug = _tc => {
  const ydoc = new Y.Doc()
  const yxml = /** @type {Y.XmlText} */ (ydoc.get('', Y.XmlText))
  const delta = [
    { insert: 'A', attributes: { em: {}, strong: {} } },
    { insert: 'B', attributes: { em: {} } },
    { insert: 'C', attributes: { em: {}, strong: {} } }
  ]
  yxml.applyDelta(delta)
  t.compare(yxml.getContent().toJSON(), delta)
}

/**
 * @param {t.TestCase} _tc
 */
export const testElement = _tc => {
  const ydoc = new Y.Doc()
  const yxmlel = ydoc.getXmlElement()
  const text1 = new Y.XmlText('text1')
  const text2 = new Y.XmlText('text2')
  yxmlel.insert(0, [text1, text2])
  t.compareArrays(yxmlel.toArray(), [text1, text2])
}

/**
 * @param {t.TestCase} _tc
 */
export const testFragmentAttributedContent = _tc => {
  const ydoc = new Y.Doc({ gc: false })
  const yfragment = new Y.XmlFragment()
  const elem1 = new Y.XmlText('hello')
  const elem2 = new Y.XmlElement()
  const elem3 = new Y.XmlText('world')
  yfragment.insert(0, [elem1, elem2])
  ydoc.getArray().insert(0, [yfragment])
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
    const expectedContent = delta.createArrayDelta().insert([elem1], null, { delete: [] }).insert([elem2]).insert([elem3], null, { insert: [] })
    const attributedContent = yfragment.getContent(attributionManager)
    console.log(attributedContent.children.toJSON())
    t.assert(attributedContent.children.equals(expectedContent))
    t.compare(elem1.getContent(attributionManager).toJSON(), delta.createTextDelta().insert('hello', null, { delete: [] }).done().toJSON())
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testElementAttributedContent = _tc => {
  const ydoc = new Y.Doc({ gc: false })
  const yelement = ydoc.getXmlElement('p')
  const elem1 = new Y.XmlText('hello')
  const elem2 = new Y.XmlElement('span')
  const elem3 = new Y.XmlText('world')
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
      yelement.setAttribute('key', '42')
    })
    const expectedContent = delta.createArrayDelta().insert([elem1], null, { delete: [] }).insert([elem2]).insert([elem3], null, { insert: [] })
    const attributedContent = yelement.getContent(attributionManager)
    console.log('children', attributedContent.children.toJSON())
    console.log('attributes', attributedContent.attributes)
    t.assert(attributedContent.children.equals(expectedContent))
    t.compare(attributedContent.attributes, { key: { prevValue: undefined, value: '42', attribution: { insert: [] } } })
    t.group('test getContentDeep', () => {
      const expectedContent = delta.createArrayDelta().insert(
        [delta.createTextDelta().insert('hello', null, { delete: [] })],
        null,
        { delete: [] }
      ).insert([{ nodeName: 'span', children: delta.createArrayDelta(), attributes: {} }])
        .insert([
          delta.createTextDelta().insert('world', null, { insert: [] })
        ], null, { insert: [] })
      const attributedContent = yelement.getContentDeep(attributionManager)
      console.log('children', JSON.stringify(attributedContent.children.toJSON(), null, 2))
      console.log('cs expec', JSON.stringify(expectedContent.toJSON(), null, 2))
      console.log('attributes', attributedContent.attributes)
      t.assert(attributedContent.children.equals(expectedContent))
      t.compare(attributedContent.attributes, { key: { prevValue: undefined, value: '42', attribution: { insert: [] } } })
      t.assert(attributedContent.nodeName === 'UNDEFINED')
    })
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testElementAttributedContentViaDiffer = _tc => {
  const ydocV1 = new Y.Doc()
  ydocV1.getXmlElement('p').insert(0, [new Y.XmlText('hello'), new Y.XmlElement('span')])
  const ydoc = new Y.Doc()
  Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(ydocV1))
  const yelement = ydoc.getXmlElement('p')
  const elem2 = yelement.get(1) // new Y.XmlElement('span')
  const elem3 = new Y.XmlText('world')
  ydoc.transact(() => {
    yelement.delete(0, 1)
    yelement.insert(1, [elem3])
    yelement.setAttribute('key', '42')
  })
  const attributionManager = Y.createAttributionManagerFromDiff(ydocV1, ydoc)
  const expectedContent = delta.createArrayDelta().insert([delta.createTextDelta().insert('hello')], null, { delete: [] }).insert([elem2.getContentDeep()]).insert([delta.createTextDelta().insert('world', null, { insert: [] })], null, { insert: [] })
  const attributedContent = yelement.getContentDeep(attributionManager)
  console.log('children', attributedContent.children.toJSON())
  console.log('attributes', attributedContent.attributes)
  t.compare(attributedContent.children.toJSON(), expectedContent.toJSON())
  t.assert(attributedContent.children.equals(expectedContent))
  t.compare(attributedContent.attributes, { key: { prevValue: undefined, value: '42', attribution: { insert: [] } } })
  t.group('test getContentDeep', () => {
    const expectedContent = delta.createArrayDelta().insert(
      [delta.createTextDelta().insert('hello')],
      null,
      { delete: [] }
    ).insert([{ nodeName: 'span', children: delta.createArrayDelta(), attributes: {} }])
      .insert([
        delta.createTextDelta().insert('world', null, { insert: [] })
      ], null, { insert: [] })
    const attributedContent = yelement.getContentDeep(attributionManager)
    console.log('children', JSON.stringify(attributedContent.children.toJSON(), null, 2))
    console.log('cs expec', JSON.stringify(expectedContent.toJSON(), null, 2))
    console.log('attributes', attributedContent.attributes)
    t.assert(attributedContent.children.equals(expectedContent))
    t.compare(attributedContent.attributes, { key: { prevValue: undefined, value: '42', attribution: { insert: [] } } })
    t.assert(attributedContent.nodeName === 'UNDEFINED')
  })
  ydoc.transact(() => {
    elem3.insert(0, 'big')
  })
  t.group('test getContentDeep after some more updates', () => {
    t.info('expecting diffingAttributionManager to auto update itself')
    const expectedContent = delta.createArrayDelta().insert(
      [delta.createTextDelta().insert('hello')],
      null,
      { delete: [] }
    ).insert([{ nodeName: 'span', children: delta.createArrayDelta(), attributes: {} }])
      .insert([
        delta.createTextDelta().insert('bigworld', null, { insert: [] })
      ], null, { insert: [] })
    const attributedContent = yelement.getContentDeep(attributionManager)
    console.log('children', JSON.stringify(attributedContent.children.toJSON(), null, 2))
    console.log('cs expec', JSON.stringify(expectedContent.toJSON(), null, 2))
    console.log('attributes', attributedContent.attributes)
    t.assert(attributedContent.children.equals(expectedContent))
    t.compare(attributedContent.attributes, { key: { prevValue: undefined, value: '42', attribution: { insert: [] } } })
    t.assert(attributedContent.nodeName === 'UNDEFINED')
  })
  Y.applyUpdate(ydocV1, Y.encodeStateAsUpdate(ydoc))
  t.group('test getContentDeep both docs synced', () => {
    t.info('expecting diffingAttributionManager to auto update itself')
    const expectedContent = delta.createArrayDelta().insert([{ nodeName: 'span', children: delta.createArrayDelta(), attributes: {} }]).insert([
      delta.createTextDelta().insert('bigworld', null, { acceptInsert: ['unknown'] })
    ], null, { acceptInsert: ['unknown'] })
    const attributedContent = yelement.getContentDeep(attributionManager)
    console.log('children', JSON.stringify(attributedContent.children.toJSON(), null, 2))
    console.log('cs expec', JSON.stringify(expectedContent.toJSON(), null, 2))
    console.log('attributes', attributedContent.attributes)
    t.assert(attributedContent.children.equals(expectedContent))
    t.compare(attributedContent.attributes, { key: { prevValue: undefined, value: '42', attribution: { acceptInsert: ['unknown'] } } })
    t.assert(attributedContent.nodeName === 'UNDEFINED')
  })
}

/**
 * @param {t.TestCase} _tc
 */
export const testAttributionManagerSimpleExample = _tc => {
  const ydoc = new Y.Doc()
  ydoc.clientID = 0
  // create some initial content
  ydoc.getXmlFragment().insert(0, [new Y.XmlText('hello world')])
  const ydocFork = new Y.Doc()
  ydocFork.clientID = 1
  Y.applyUpdate(ydocFork, Y.encodeStateAsUpdate(ydoc))
  // modify the fork
  // append a span element
  ydocFork.getXmlFragment().insert(1, [new Y.XmlElement('span')])
  const ytext = /** @type {Y.XmlText} */ (ydocFork.getXmlFragment().get(0))
  // make "hello" italic
  ytext.format(0, 5, { italic: true })
  ytext.insert(11, 'deleteme')
  ytext.delete(11, 8)
  ytext.insert(11, '!')
  // highlight the changes
  console.log(JSON.stringify(ydocFork.getXmlFragment().getContentDeep(Y.createAttributionManagerFromDiff(ydoc, ydocFork)), null, 2))
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
