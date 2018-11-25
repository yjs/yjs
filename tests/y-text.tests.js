import { initArrays, compareUsers } from './helper.js'
import { test, proxyConsole } from 'cutest'

proxyConsole()

test('basic insert delete', async function text0 (t) {
  let { users, text0 } = await initArrays(t, { users: 2 })
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

  await compareUsers(t, users)
})

test('basic format', async function text1 (t) {
  let { users, text0 } = await initArrays(t, { users: 2 })
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
  text0.insert(0, 'z', {bold: true})
  t.assert(text0.toString() === 'zb')
  t.compare(text0.toDelta(), [{ insert: 'zb', attributes: { bold: true } }])
  t.compare(delta, [{ insert: 'z', attributes: { bold: true } }])
  t.assert(text0._start._right._right._right._content === 'b', 'Does not insert duplicate attribute marker')
  text0.insert(0, 'y')
  t.assert(text0.toString() === 'yzb')
  t.compare(text0.toDelta(), [{ insert: 'y' }, { insert: 'zb', attributes: { bold: true } }])
  t.compare(delta, [{ insert: 'y' }])
  text0.format(0, 2, { bold: null })
  t.assert(text0.toString() === 'yzb')
  t.compare(text0.toDelta(), [{ insert: 'yz' }, { insert: 'b', attributes: { bold: true } }])
  t.compare(delta, [{ retain: 1 }, { retain: 1, attributes: { bold: null } }])
  await compareUsers(t, users)
})

test('quill issue 1', async function quill1 (t) {
  let { testConnector, users, quill0 } = await initArrays(t, { users: 2 })
  quill0.insertText(0, 'x')
  testConnector.flushAllMessages()
  quill0.insertText(1, '\n', 'list', 'ordered')
  testConnector.flushAllMessages()
  quill0.insertText(1, '\n', 'list', 'ordered')
  await compareUsers(t, users)
})

test('quill issue 2', async function quill2 (t) {
  let { testConnector, users, quill0, text0 } = await initArrays(t, { users: 2 })
  let delta
  text0.observe(event => {
    delta = event.delta
  })
  quill0.insertText(0, 'abc', 'bold', true)
  testConnector.flushAllMessages()
  quill0.insertText(1, 'x')
  quill0.update()
  t.compare(delta, [{ retain: 1 }, { insert: 'x', attributes: { bold: true } }])
  await compareUsers(t, users)
})

test('quill issue 3', async function quill3 (t) {
  let { users, quill0, text0 } = await initArrays(t, { users: 2 })
  quill0.insertText(0, 'a')
  quill0.insertText(1, '\n\n', 'list', 'ordered')
  quill0.insertText(2, 'b')
  t.compare(text0.toDelta(), [
    { insert: 'a' },
    { insert: '\n', attributes: { list: 'ordered' } },
    { insert: 'b' },
    { insert: '\n', attributes: { list: 'ordered' } }
  ])
  await compareUsers(t, users)
})
