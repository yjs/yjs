import { init, compare } from './testHelper.js'
import * as Y from '../src/index.js'

import * as t from 'lib0/testing'

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
  t.compare(yxml.toDelta(), delta)
}

/**
 * @param {t.TestCase} tc
 */
export const testCleanupTransactions = tc => {
  const ydoc = new Y.Doc()
  const yxml = ydoc.getXmlFragment('')
  ydoc.on('afterTransaction', tr => {
    if (tr.origin === 'test') {
      yxml.toJSON()
    }
  })
  ydoc.transact(tr => {
    for (let i = 0; i < 100000; i++) {
      yxml.push([new Y.XmlText('a')])
    }
  }, 'test')
}
