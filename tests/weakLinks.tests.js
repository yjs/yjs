import * as Y from '../src/index.js'
import * as t from 'lib0/testing'
import { init, compare } from './testHelper.js'

/**
 * @param {t.TestCase} tc
 */
export const testBasicMap = tc => {
  const doc = new Y.Doc()
  const map = doc.getMap('map')
  
  const nested = new Y.Map()
  nested.set('a1', 'hello')
  map.set('a', nested)
  const link = map.link('a')
  map.set('b', link)

  const link2 = /** @type {Y.WeakLink<any>} */ (map.get('b'))
  const expected = nested.toJSON()
  const actual = link2.deref().toJSON()
  t.compare(actual, expected)
}

/**
 * @param {t.TestCase} tc
 */
export const testBasicArray = tc => {
  const doc = new Y.Doc()
  const array = doc.getArray('array')
  array.insert(0, [1,2,3])
  array.insert(3, [array.link(1)])

  t.compare(array.get(0), 1)
  t.compare(array.get(1), 2)
  t.compare(array.get(2), 3)
  t.compare(array.get(3).deref(), 2)
}

/**
 * @param {t.TestCase} tc
 */
export const testUpdate = tc => {
  const { testConnector, users, map0, map1 } = init(tc, { users: 2 })
  map0.set('a', new Y.Map([['a1', 'hello']]))
  const link0 = /** @type {Y.WeakLink<Y.Map<any>>} */ (map0.link('a'))
  map0.set('b', link0)

  testConnector.flushAllMessages()
  const link1 = /** @type {Y.WeakLink<Y.Map<any>>} */ (map1.get('b'))
  let l1 = /** @type {Y.Map<any>} */ (link1.deref())
  let l0 = /** @type {Y.Map<any>} */ (link0.deref())
  t.compare(l1.get('a1'), l0.get('a1'))

  map1.get('a').set('a2', 'world')

  testConnector.flushAllMessages()

  l1 = /** @type {Y.Map<any>} */ (link1.deref())
  l0 = /** @type {Y.Map<any>} */ (link0.deref())
  t.compare(l1.get('a2'), l0.get('a2'))

  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testDeleteWeakLink = tc => {
  const { testConnector, users, map0, map1 } = init(tc, { users: 2 })
  map0.set('a', new Y.Map([['a1', 'hello']]))
  const link0 = /** @type {Y.WeakLink<Y.Map<any>>} */ (map0.link('a'))
  map0.set('b', link0)

  testConnector.flushAllMessages()
  const link1 = /** @type {Y.WeakLink<Y.Map>} */ map1.get('b')
  const l0 = /** @type {Y.Map<any>} */ (link0.deref())
  t.compare(link1.ref.get('a1'), l0.get('a1'))

  map1.delete('b') // delete links

  testConnector.flushAllMessages()

  // since links have been deleted, they no longer refer to any content
  t.compare(link0.deref(), undefined)
  t.compare(link1.deref(), undefined)

  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testDeleteSource = tc => {
  const { testConnector, users, map0, map1 } = init(tc, { users: 2 })
  map0.set('a', new Y.Map([['a1', 'hello']]))
  const link0 = /** @type {Y.WeakLink<Y.Map<any>>} */ (map0.link('a'))
  map0.set('b', link0)

  testConnector.flushAllMessages()
  const link1 = /** @type {Y.WeakLink<Y.Map<any>>} */ (map1.get('b'))
  let l1 = /** @type {Y.Map<any>} */ (link1.deref())
  let l0 = /** @type {Y.Map<any>} */ (link0.deref())
  t.compare(l1.get('a1'), l0.get('a1'))

  map1.delete('a') // delete source of the link

  testConnector.flushAllMessages()

  // since source have been deleted, links no longer refer to any content
  t.compare(link0.deref(), undefined)
  t.compare(link1.deref(), undefined)

  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testObserve = tc => {
  const doc = new Y.Doc()
  const map = doc.getMap('map')
  const array = doc.getArray('array')
  /**
   * @type {Array<any>}
   */
  let delta
  array.observe((e) => delta = e.changes.delta)

  map.set('key', 'value1')
  const link = map.link('key')
  array.insert(0, [link])

  delta = []

  map.set('key', 'value2')
  t.compare(delta, [{ delete: 1 }, { insert: 'value2' }])
}

/**
 * @param {t.TestCase} tc
 */
export const testDeepObserve = tc => {
  const doc = new Y.Doc()
  const map = doc.getMap('map')
  const array = doc.getArray('array')
  /**
   * @type {Array<any>}
   */
  let events
  array.observeDeep((e) => events = e)

  const nested = new Y.Map([['key', 'value']])
  map.set('key', nested)
  const link = map.link('key')
  array.insert(0, [link])

  events = []

  nested.set('key', 'value2')
  for (let i = 0; i < events.length; i++) {
    let e = events[i]
    throw new Error('todo')
  }
}

/**
 * @param {t.TestCase} tc
 */
export const testObserveRecursive = tc => {
  const doc = new Y.Doc()
  const map = doc.getMap('map')
  const array = doc.getArray('array')
  /**
   * @type {any}
   */
  let arrayChanges
  array.observe((e) => arrayChanges = e.changes)
  /**
   * @type {any}
   */
  let mapChanges
  map.observe((e) => mapChanges = e.changes)

  Y.transact(doc, () => {
    map.set('key', 'map-value')
    array.insert(0, [map.link('key')])
    map.set('key2', array.link(0))
  })
  t.compare(arrayChanges.delta, [{ insert: 'map-value' }])
  t.compare(mapChanges.keys.get('key2'), [{ action: 'insert', oldValue: 'map-value' }])

  t.compare(map.get('key2').deref().deref(), 'map-value')
}