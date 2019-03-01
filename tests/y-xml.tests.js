import { initArrays, compareUsers } from './helper.js'
import { test } from 'cutest'
import * as Y from '../src/index.js'

test('set property', async function xml0 (t) {
  var { testConnector, users, xml0, xml1 } = await initArrays(t, { users: 2 })
  xml0.setAttribute('height', '10')
  t.assert(xml0.getAttribute('height') === '10', 'Simple set+get works')
  testConnector.flushAllMessages()
  t.assert(xml1.getAttribute('height') === '10', 'Simple set+get works (remote)')
  await compareUsers(t, users)
})

test('events', async function xml1 (t) {
  var { testConnector, users, xml0, xml1 } = await initArrays(t, { users: 2 })
  var event = { attributesChanged: new Set() }
  var remoteEvent = { attributesChanged: new Set() }
  xml0.observe(e => {
    delete e._content
    delete e.nodes
    delete e.values
    event = e
  })
  xml1.observe(e => {
    delete e._content
    delete e.nodes
    delete e.values
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
  await compareUsers(t, users)
})

test('attribute modifications (y -> dom)', async function xml2 (t) {
  var { users, xml0, dom0 } = await initArrays(t, { users: 3 })
  xml0.setAttribute('height', '100px')
  t.assert(dom0.getAttribute('height') === '100px', 'setAttribute')
  xml0.removeAttribute('height')
  t.assert(dom0.getAttribute('height') == null, 'removeAttribute')
  xml0.setAttribute('class', 'stuffy stuff')
  t.assert(dom0.getAttribute('class') === 'stuffy stuff', 'set class attribute')
  await compareUsers(t, users)
})

test('element insert (y -> dom)', async function xml5 (t) {
  var { users, xml0, dom0 } = await initArrays(t, { users: 3 })
  xml0.insert(0, [new Y.XmlText('some text')])
  xml0.insert(1, [new Y.XmlElement('p')])
  t.assert(dom0.childNodes[0].textContent === 'some text', 'Retrieve Text node')
  t.assert(dom0.childNodes[1].nodeName === 'P', 'Retrieve Element node')
  await compareUsers(t, users)
})

test('y on insert, then delete (y -> dom)', async function xml7 (t) {
  var { users, xml0, dom0 } = await initArrays(t, { users: 3 })
  xml0.insert(0, [new Y.XmlElement('p')])
  t.assert(dom0.childNodes[0].nodeName === 'P', 'Get inserted element from dom')
  xml0.delete(0, 1)
  t.assert(dom0.childNodes.length === 0, '#childNodes is empty after delete')
  await compareUsers(t, users)
})

test('delete consecutive (1) (Text)', async function xml8 (t) {
  var { users, xml0, dom0 } = await initArrays(t, { users: 3 })
  xml0.insert(0, [new Y.XmlText('1'), new Y.XmlText('2'), new Y.XmlText('3')])
  xml0.delete(1, 2)
  t.assert(xml0.length === 1, 'check length (y)')
  t.assert(dom0.childNodes.length === 1, 'check length (dom)')
  t.assert(dom0.childNodes[0].textContent === '1', 'check content')
  await compareUsers(t, users)
})

test('delete consecutive (2) (Text)', async function xml9 (t) {
  var { users, xml0, dom0 } = await initArrays(t, { users: 3 })
  xml0.insert(0, [new Y.XmlText('1'), new Y.XmlText('2'), new Y.XmlText('3')])
  xml0.delete(0, 1)
  xml0.delete(1, 1)
  t.assert(xml0.length === 1, 'check length (y)')
  t.assert(dom0.childNodes.length === 1, 'check length (dom)')
  t.assert(dom0.childNodes[0].textContent === '2', 'check content')
  await compareUsers(t, users)
})

test('delete consecutive (1) (Element)', async function xml10 (t) {
  var { users, xml0, dom0 } = await initArrays(t, { users: 3 })
  xml0.insert(0, [new Y.XmlElement('A'), new Y.XmlElement('B'), new Y.XmlElement('C')])
  xml0.delete(1, 2)
  t.assert(xml0.length === 1, 'check length (y)')
  t.assert(dom0.childNodes.length === 1, 'check length (dom)')
  t.assert(dom0.childNodes[0].nodeName === 'A', 'check content')
  await compareUsers(t, users)
})

test('delete consecutive (2) (Element)', async function xml11 (t) {
  var { users, xml0, dom0 } = await initArrays(t, { users: 3 })
  xml0.insert(0, [new Y.XmlElement('A'), new Y.XmlElement('B'), new Y.XmlElement('C')])
  xml0.delete(0, 1)
  xml0.delete(1, 1)
  t.assert(xml0.length === 1, 'check length (y)')
  t.assert(dom0.childNodes.length === 1, 'check length (dom)')
  t.assert(dom0.childNodes[0].nodeName === 'B', 'check content')
  await compareUsers(t, users)
})

test('Receive a bunch of elements (with disconnect)', async function xml12 (t) {
  var { testConnector, users, xml0, xml1, dom0, dom1 } = await initArrays(t, { users: 3 })
  users[1].disconnect()
  xml0.insert(0, [new Y.XmlElement('A'), new Y.XmlElement('B'), new Y.XmlElement('C')])
  xml0.insert(0, [new Y.XmlElement('X'), new Y.XmlElement('Y'), new Y.XmlElement('Z')])
  await users[1].connect()
  testConnector.flushAllMessages()
  t.assert(xml0.length === 6, 'check length (y)')
  t.assert(xml1.length === 6, 'check length (y) (reconnected user)')
  t.assert(dom0.childNodes.length === 6, 'check length (dom)')
  t.assert(dom1.childNodes.length === 6, 'check length (dom) (reconnected user)')
  await compareUsers(t, users)
})

test('treeWalker', async function xml17 (t) {
  var { users, xml0 } = await initArrays(t, { users: 3 })
  let paragraph1 = new Y.XmlElement('p')
  let paragraph2 = new Y.XmlElement('p')
  let text1 = new Y.XmlText('init')
  let text2 = new Y.XmlText('text')
  paragraph1.insert(0, [text1, text2])
  xml0.insert(0, [paragraph1, paragraph2, new Y.XmlElement('img')])
  let allParagraphs = xml0.querySelectorAll('p')
  t.assert(allParagraphs.length === 2, 'found exactly two paragraphs')
  t.assert(allParagraphs[0] === paragraph1, 'querySelectorAll found paragraph1')
  t.assert(allParagraphs[1] === paragraph2, 'querySelectorAll found paragraph2')
  t.assert(xml0.querySelector('p') === paragraph1, 'querySelector found paragraph1')
  await compareUsers(t, users)
})
