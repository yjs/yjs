import { init, compare } from './testHelper.js'
import * as Y from '../src/index.js'

import * as t from 'lib0/testing.js'

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
  paragraph1.setAttribute('custom', '123')
  paragraph1.insert(0, [text1, text2])
  xml0.insert(0, [paragraph1, paragraph2, new Y.XmlElement('img')])
  const allParagraphs = xml0.querySelectorAll('p')
  const paragraph1ID = paragraph1._item ? paragraph1._item.id : undefined
  t.assert(allParagraphs.length === 2, 'found exactly two paragraphs')
  t.assert(allParagraphs[0] === paragraph1, 'querySelectorAll found paragraph1')
  t.assert(allParagraphs[1] === paragraph2, 'querySelectorAll found paragraph2')
  t.assert(xml0.querySelectorAll({ tagname: 'p' }).length === 2, 'found exactly two paragraphs by tagname')
  t.assert(xml0.querySelectorAll({ id: paragraph1ID })[0] === paragraph1, 'querySelectorAll found paragraph1 by id')
  t.assert(xml0.querySelectorAll({ attributes: { custom: '123' } })[0] === paragraph1, 'querySelectorAll found paragraph1 by attribute')
  t.assert(xml0.querySelector('p') === paragraph1, 'querySelector found paragraph1 by string query')
  t.assert(xml0.querySelector({ tagname: 'p' }) === paragraph1, 'querySelector found paragraph1 by tagname')
  t.assert(xml0.querySelector({ id: paragraph1ID }) === paragraph1, 'querySelector found paragraph1 by id')
  t.assert(xml0.querySelector({ attributes: { custom: '123' } }) === paragraph1, 'querySelector found paragraph1 by attribute')
  compare(users)
}
