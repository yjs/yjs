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
export const testDeepObserveTransitive = tc => {
  // test observers in a face of linked chains of values
  const doc = new Y.Doc()

  /*
     Structure:
       - map1
         - link-key: <=+-+
       - map2:         | |
         - key: value1-+ |
         - link-link: <--+
   */

  const map1 = doc.getMap('map1')
  const map2 = doc.getMap('map2')

  map2.set('key', 'value1')
  const link1 = /** @type {Y.WeakLink<String>} */ (map2.link('key'))
  map1.set('link-key', link1)
  const link2 =  /** @type {Y.WeakLink<String>} */ (map1.link('link-key'))
  map2.set('link-link', link2)

  /**
   * @type {Array<any>}
   */
  let events = []
  link2.observeDeep((e) => events = e)
  map2.set('key', 'value2')
  const values = events.map((e) => e.target.deref())
  t.compare(values, ['value2'])
}
/**
 * @param {t.TestCase} tc
 */
export const testDeepObserveTransitive2 = tc => {
  // test observers in a face of multi-layer linked chains of values
  const doc = new Y.Doc()

  /*
     Structure:
       - map1
         - link-key: <=+-+
       - map2:         | |
         - key: value1-+ |
         - link-link: <==+--+
       - map3:              |
         - link-link-link:<-+
   */

  const map1 = doc.getMap('map1')
  const map2 = doc.getMap('map2')
  const map3 = doc.getMap('map3')

  map2.set('key', 'value1')
  const link1 = /** @type {Y.WeakLink<String>} */ (map2.link('key'))
  map1.set('link-key', link1)
  const link2 =  /** @type {Y.WeakLink<String>} */ (map1.link('link-key'))
  map2.set('link-link', link2)
  const link3 =  /** @type {Y.WeakLink<String>} */ (map2.link('link-link'))
  map3.set('link-link-link', link3)

  /**
   * @type {Array<any>}
   */
  let events = []
  link3.observeDeep((e) => events = e)
  map2.set('key', 'value2')
  const values = events.map((e) => e.target.deref())
  t.compare(values, ['value2'])
}

/**
 * @param {t.TestCase} tc
 */
export const testDeepObserveMap = tc => {
  // test observers in a face of linked chains of values
  const doc = new Y.Doc()
  /*
     Structure:
       - map (observed):
         - link:<----+
       - array:      |
          0: nested:-+
            - key: value
   */
  const map = doc.getMap('map')
  const array = doc.getArray('array')

  /**
   * @type {Array<any>}
   */
  let events = []
  map.observeDeep((e) => events = e)

  const nested = new Y.Map()
  array.insert(0, [nested])
  const link = array.link(0)
  map.set('link', link)

  // update entry in linked map
  events = []
  nested.set('key', 'value')
  t.compare(events.length, 1)
  t.compare(events[0].target, nested)
  t.compare(events[0].keys, new Map([['key', {action:'add', oldValue: undefined}]]))

  // delete entry in linked map
  events = []
  nested.delete('key')
  t.compare(events.length, 1)
  t.compare(events[0].target, nested)
  t.compare(events[0].keys, new Map([['key', {action:'delete', oldValue: undefined}]]))
  
  // delete linked map
  array.delete(0)
  t.compare(events.length, 1)
  t.compare(events[0].target, link)
}

/**
 * @param {t.TestCase} tc
 */
const testDeepObserveArray = tc => { //FIXME
  // test observers in a face of linked chains of values
  const doc = new Y.Doc()
  /*
     Structure:
       - map:
         - nested: --------+
           - key: value    |
       - array (observed): |
         0: <--------------+
   */
  const map = doc.getMap('map')
  const array = doc.getArray('array')

  /**
   * @type {Array<any>}
   */
  let events = []
  array.observeDeep((e) => events = e)

  const nested = new Y.Map()
  map.set('nested', nested)
  const link = map.link('nested')
  array.insert(0, [link])

  // update entry in linked map
  events = []
  nested.set('key', 'value')
  t.compare(events.length, 1)
  t.compare(events[0].target, nested)
  t.compare(events[0].keys, new Map([['key', {action:'add', oldValue: undefined}]]))

  nested.set('key', 'value2')
  t.compare(events.length, 1)
  t.compare(events[0].target, nested)
  t.compare(events[0].keys, new Map([['key', {action:'update', oldValue: undefined}]]))

  // delete entry in linked map
  nested.delete('key')
  t.compare(events.length, 1)
  t.compare(events[0].target, nested)
  t.compare(events[0].keys, new Map([['key', {action:'delete', oldValue: undefined}]]))
  
  // delete linked map
  map.delete('nested')
  t.compare(events.length, 1)
  t.compare(events[0].target, map)
  t.compare(events[0].keys, new Map([['nested', {action:'delete', oldValue: undefined}]]))
}
/**
 * @param {t.TestCase} tc
 */
const testMapDeepObserve = tc => { //FIXME
  const doc = new Y.Doc()
  const outer = doc.getMap('outer')
  const inner = new Y.Map()
  outer.set('inner', inner)

  /**
   * @type {Array<any>}
   */
  let events = []
  outer.observeDeep((e) => events = e)

  inner.set('key', 'value1')
  t.compare(events.length, 1)
  t.compare(events[0].target, inner)
  t.compare(events[0].keys, new Map([['key', {action:'add', oldValue: undefined}]]))
  
  events = []
  inner.set('key', 'value2')
  t.compare(events.length, 1)
  t.compare(events[0].target, inner)
  t.compare(events[0].keys, new Map([['key', {action:'update', oldValue: undefined}]]))

  events = []
  inner.delete('key')
  t.compare(events.length, 1)
  t.compare(events[0].target, inner)
  t.compare(events[0].keys, new Map([['key', {action:'delete', oldValue: undefined}]]))
}

/**
 * @param {t.TestCase} tc
 */
export const testDeepObserveRecursive = tc => {
  // test observers in a face of cycled chains of values
  const doc = new Y.Doc()
  /*
     Structure:
      array (observed):
        m0:--------+
         - k1:<-+  |
                |  |
        m1------+  |
         - k2:<-+  |
                |  |
        m2------+  |
         - k0:<----+
   */
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
  m0.set('k1', l1)
  m1.set('k2', l2)
  m2.set('k0', l0)

  /**
   * @type {Array<any>}
   */
  let events = []
  m0.observeDeep((e) => events = e)

  m1.set('test-key1', 'value1')
  t.compare(events.length, 1)
  t.compare(events[0].target, m1)
  t.compare(events[0].keys, new Map([['test-key1', {action:'add', oldValue: undefined}]]))
  
  events = []
  m2.set('test-key2', 'value2')
  t.compare(events.length, 1)
  t.compare(events[0].target, m2)
  t.compare(events[0].keys, new Map([['test-key2', {action:'add', oldValue: undefined}]]))

  m1.delete('test-key1')
  t.compare(events.length, 1)
  t.compare(events[0].target, m1)
  t.compare(events[0].keys, new Map([['test-key1', {action:'delete', oldValue: undefined}]]))
}

/**
 * @param {t.TestCase} tc
 */
export const testRemoteMapUpdate = tc => {
  const { testConnector, users, map0, map1, map2 } = init(tc, { users: 3 })

  map0.set('key', 1)
  testConnector.flushAllMessages()

  map1.set('link', map1.link('key'))
  map0.set('key', 2)
  map0.set('key', 3)

  // apply updated content first, link second
  console.log('update U0 -> U2')
  Y.applyUpdate(users[2], Y.encodeStateAsUpdate(users[0])) 
  console.log('update U1 -> U2')
  Y.applyUpdate(users[2], Y.encodeStateAsUpdate(users[1]))

  // make sure that link can find the most recent block
  const link2 = map2.get('link')
  t.compare(link2.deref(), 3)

  testConnector.flushAllMessages()

  const link1 = map1.get('link')
  const link0 = map0.get('link')

  t.compare(link0.deref(), 3)
  t.compare(link1.deref(), 3)
  t.compare(link2.deref(), 3)
}