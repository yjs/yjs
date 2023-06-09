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
  const { testConnector, array0, array1 } = init(tc, {users:2})
  array0.insert(0, [1,2,3])
  array0.insert(3, [array0.link(1)])

  t.compare(array0.get(0), 1)
  t.compare(array0.get(1), 2)
  t.compare(array0.get(2), 3)
  t.compare(array0.get(3).deref(), 2)

  testConnector.flushAllMessages()

  t.compare(array1.get(0), 1)
  t.compare(array1.get(1), 2)
  t.compare(array1.get(2), 3)
  t.compare(array1.get(3).deref(), 2)
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
  const l1 = /** @type {Y.Map<any>} */ (link1.deref())
  const l0 = /** @type {Y.Map<any>} */ (link0.deref())
  t.compare(l1.get('a1'), l0.get('a1'))

  map1.delete('b') // delete links

  testConnector.flushAllMessages()

  // since links have been deleted, they no longer refer to any content
  t.compare(link0.deref(), undefined)
  t.compare(link1.deref(), undefined)
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
}

/**
 * @param {t.TestCase} tc
 */
export const testObserveMapUpdate = tc => {
  const { testConnector, users, map0, map1 } = init(tc, { users: 2 })
  map0.set('a', 'value')
  const link0 = /** @type {Y.WeakLink<String>} */ (map0.link('a'))
  map0.set('b', link0)
  /**
   * @type {any}
   */
  let target0
  link0.observe((e) => target0 = e.target)

  testConnector.flushAllMessages()

  let link1 = /** @type {Y.WeakLink<String>} */ (map1.get('b'))
  t.compare(link1.deref(), 'value')
  /**
   * @type {any}
   */
  let target1
  link1.observe((e) => target1 = e.target)

  map0.set('a', 'value2')
  t.compare(target0.deref(), 'value2')

  testConnector.flushAllMessages()
  t.compare(target1.deref(), 'value2')
}

/**
 * @param {t.TestCase} tc
 */
export const testObserveMapDelete = tc => {
  const { testConnector, users, map0, map1 } = init(tc, { users: 2 })
  map0.set('a', 'value')
  const link0 = /** @type {Y.WeakLink<String>} */ (map0.link('a'))
  map0.set('b', link0)
  /**
   * @type {any}
   */
  let target0
  link0.observe((e) => target0 = e.target)

  testConnector.flushAllMessages()

  let link1 = /** @type {Y.WeakLink<String>} */ (map1.get('b'))
  t.compare(link1.deref(), 'value')
  /**
   * @type {any}
   */
  let target1
  link1.observe((e) => target1 = e.target)

  map0.delete('a')
  t.compare(target0.deref(), undefined)

  testConnector.flushAllMessages()
  t.compare(target1.deref(), undefined)
}
/**
 * @param {t.TestCase} tc
 */
export const testObserveArray = tc => {
  const { testConnector, array0, array1 } = init(tc, { users: 2 })
  array0.insert(0, ['A','B','C'])
  const link0 = /** @type {Y.WeakLink<String>} */ (array0.link(1))
  array0.insert(0, [link0])
  /**
   * @type {any}
   */
  let target0
  link0.observe((e) => target0 = e.target)

  testConnector.flushAllMessages()

  let link1 = /** @type {Y.WeakLink<String>} */ (array1.get(0))
  t.compare(link1.deref(), 'B')
  /**
   * @type {any}
   */
  let target1
  link1.observe((e) => target1 = e.target)

  array0.delete(2)
  t.compare(target0.deref(), undefined)

  testConnector.flushAllMessages()
  t.compare(target1.deref(), undefined)
}

/**
 * @param {t.TestCase} tc
 */
 const testObserveTransitive = tc => {
  // test observers in a face of linked chains of values
  const doc = new Y.Doc()
  const map1 = doc.getMap('map1')
  const map2 = doc.getMap('map2')
  /**
   * @type {Map<string, { action: 'add' | 'update' | 'delete', oldValue: any, newValue: any }>}
   */
  let keys
  map2.observe((e) => keys = e.keys)

  map2.set('a2', 'value1')
  const link1 = map2.link('a2')
  map1.set('a1', link1)
  const link2 = map1.link('a1')
  map2.set('b2', link2) // make 'b2' link to value of 'a1' which is a link to 'a2'

  keys = /** @type {any} */ (null)
  map2.set('a2', 'value2')

  t.compare(keys.get('a2'), { action:'update', oldValue: 'value1', newValue: 'value2' })
  t.compare(keys.get('b2'), { action:'update', oldValue: 'value1', newValue: 'value2' })
}

/**
 * @param {t.TestCase} tc
 */
 const testDeepObserveMap = tc => {
  // test observers in a face of linked chains of values
  const doc = new Y.Doc()
  const map = doc.getMap('map')
  const array = doc.getArray('array')

  /**
   * @type {Array<any>}
   */
  let event = []
  map.observeDeep((e) => event = e)

  const nested = new Y.Map()
  array.insert(0, [nested])
  const link = array.link(0)
  map.set('link', link)

  // update entry in linked map
  event = []
  nested.set('key', 'value')

  t.compare(event, [{}]) //TODO

  // delete entry in linked map
  nested.delete('key')
  t.compare(event, [{}]) //TODO
  
  // delete linked map
  array.delete(0)
  t.compare(event, [{}]) //TODO
}

/**
 * @param {t.TestCase} tc
 */
 const testDeepObserveArray = tc => {
  // test observers in a face of linked chains of values
  const doc = new Y.Doc()
  const map = doc.getMap('map')
  const array = doc.getArray('array')

  /**
   * @type {Array<any>}
   */
  let event = []
  array.observeDeep((e) => event = e)

  const nested = new Y.Map()
  map.set('key', nested)
  const link = map.link('key')
  array.insert(0, [link])

  // update entry in linked map
  event = []
  nested.set('key', 'value')

  t.compare(event, [{}]) //TODO

  // delete entry in linked map
  nested.delete('key')
  t.compare(event, [{}]) //TODO
  
  // delete linked map
  map.delete('key')
  t.compare(event, [{}]) //TODO
}

/**
 * @param {t.TestCase} tc
 */
 const testDeepObserveRecursive = tc => {
  // test observers in a face of linked chains of values
  const doc = new Y.Doc()
  const root = doc.getArray('array')

  const m0 = new Y.Map()
  const m1 = new Y.Map()
  const m2 = new Y.Map()

  root.insert(0, [m0])
  root.insert(1, [m1])
  root.insert(2, [m2])

  const l0 = root.link(0)
  const l1 = root.link(1)
  const l2 = root.link(2)

  // create cyclic reference between links
  m0.set('k1', m1)
  m1.set('k2', m2)
  m2.set('k0', m0)

  /**
   * @type {Array<any>}
   */
  let events = []
  m0.observeDeep((e) => events = e)

  m1.set('test-key1', 'value1')
  t.compare(events, [{}]) //TODO
  
  events = []
  m2.set('test-key2', 'value2')
  t.compare(events, [{}]) //TODO
}