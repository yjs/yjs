import * as Y from '../src/index.js'
import * as t from 'lib0/testing'
import { init } from './testHelper.js'

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
  const { testConnector, array0, array1 } = init(tc, { users: 2 })
  array0.insert(0, [1, 2, 3])
  array0.insert(3, [array0.quote(1)])

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
export const testArrayQuoteMultipleElements = tc => {
  const { testConnector, array0, array1 } = init(tc, { users: 2 })
  const nested = new Y.Map([['key', 'value']])
  array0.insert(0, [1, 2, nested, 3])
  array0.insert(0, [array0.quote(1, 3)])

  const link0 = array0.get(0)
  t.compare(link0.unquote(), [2, nested, 3])
  t.compare(array0.get(1), 1)
  t.compare(array0.get(2), 2)
  t.compare(array0.get(3), nested)
  t.compare(array0.get(4), 3)

  testConnector.flushAllMessages()

  const link1 = array1.get(0)
  let unquoted = link1.unquote()
  t.compare(unquoted[0], 2)
  t.compare(unquoted[1].toJSON(), { key: 'value' })
  t.compare(unquoted[2], 3)
  t.compare(array1.get(1), 1)
  t.compare(array1.get(2), 2)
  t.compare(array1.get(3).toJSON(), { key: 'value' })
  t.compare(array1.get(4), 3)

  array1.insert(3, ['A', 'B'])
  unquoted = link1.unquote()
  t.compare(unquoted[0], 2)
  t.compare(unquoted[1], 'A')
  t.compare(unquoted[2], 'B')
  t.compare(unquoted[3].toJSON(), { key: 'value' })
  t.compare(unquoted[4], 3)

  testConnector.flushAllMessages()

  t.compare(array0.get(0).unquote(), [2, 'A', 'B', nested, 3])
}

/**
 * @param {t.TestCase} tc
 */
export const testSelfQuotation = tc => {
  const { testConnector, array0, array1 } = init(tc, { users: 2 })
  array0.insert(0, [1, 2, 3, 4])
  const link0 = array0.quote(0, 3)
  array0.insert(1, [link0]) // link is inserted into its own range

  t.compare(link0.unquote(), [1, link0, 2, 3])
  t.compare(array0.get(0), 1)
  t.compare(array0.get(1), link0)
  t.compare(array0.get(2), 2)
  t.compare(array0.get(3), 3)
  t.compare(array0.get(4), 4)

  testConnector.flushAllMessages()

  const link1 = array1.get(1)
  const unquoted = link1.unquote()
  t.compare(unquoted, [1, link1, 2, 3])
  t.compare(array1.get(0), 1)
  t.compare(array1.get(1), link1)
  t.compare(array1.get(2), 2)
  t.compare(array1.get(3), 3)
  t.compare(array1.get(4), 4)
}

/**
 * @param {t.TestCase} tc
 */
export const testUpdate = tc => {
  const { testConnector, map0, map1 } = init(tc, { users: 2 })
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
  const { testConnector, map0, map1 } = init(tc, { users: 2 })
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
  const { testConnector, map0, map1 } = init(tc, { users: 2 })
  map0.set('a', new Y.Map([['a1', 'hello']]))
  const link0 = /** @type {Y.WeakLink<Y.Map<any>>} */ (map0.link('a'))
  map0.set('b', link0)

  testConnector.flushAllMessages()
  const link1 = /** @type {Y.WeakLink<Y.Map<any>>} */ (map1.get('b'))
  const l1 = /** @type {Y.Map<any>} */ (link1.deref())
  const l0 = /** @type {Y.Map<any>} */ (link0.deref())
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
  const { testConnector, map0, map1 } = init(tc, { users: 2 })
  map0.set('a', 'value')
  const link0 = /** @type {Y.WeakLink<String>} */ (map0.link('a'))
  map0.set('b', link0)
  /**
   * @type {any}
   */
  let target0
  link0.observe((e) => {
    target0 = e.target
  })

  testConnector.flushAllMessages()

  const link1 = /** @type {Y.WeakLink<String>} */ (map1.get('b'))
  t.compare(link1.deref(), 'value')
  /**
   * @type {any}
   */
  let target1
  link1.observe((e) => {
    target1 = e.target
  })

  map0.set('a', 'value2')
  t.compare(target0.deref(), 'value2')

  testConnector.flushAllMessages()
  t.compare(target1.deref(), 'value2')
}

/**
 * @param {t.TestCase} tc
 */
export const testObserveMapDelete = tc => {
  const { testConnector, map0, map1 } = init(tc, { users: 2 })
  map0.set('a', 'value')
  const link0 = /** @type {Y.WeakLink<String>} */ (map0.link('a'))
  map0.set('b', link0)
  /**
   * @type {any}
   */
  let target0
  link0.observe((e) => {
    target0 = e.target
  })

  testConnector.flushAllMessages()

  const link1 = /** @type {Y.WeakLink<String>} */ (map1.get('b'))
  t.compare(link1.deref(), 'value')
  /**
   * @type {any}
   */
  let target1
  link1.observe((e) => {
    target1 = e.target
  })

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
  array0.insert(0, ['A', 'B', 'C'])
  const link0 = /** @type {Y.WeakLink<String>} */ (array0.quote(1, 2))
  array0.insert(0, [link0])
  /**
   * @type {any}
   */
  let target0
  link0.observe((e) => {
    target0 = e.target
  })

  testConnector.flushAllMessages()

  const link1 = /** @type {Y.WeakLink<String>} */ (array1.get(0))
  t.compare(link1.unquote(), ['B', 'C'])
  /**
   * @type {any}
   */
  let target1
  link1.observe((e) => {
    target1 = e.target
  })

  array0.delete(2)
  t.compare(target0.unquote(), ['C'])

  testConnector.flushAllMessages()
  t.compare(target1.unquote(), ['C'])

  array1.delete(2)
  t.compare(target1.unquote(), [])

  testConnector.flushAllMessages()
  t.compare(target0.unquote(), [])

  target0 = null
  array0.delete(1)
  t.compare(target0, null)
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
  const link2 = /** @type {Y.WeakLink<String>} */ (map1.link('link-key'))
  map2.set('link-link', link2)

  /**
   * @type {Array<any>}
   */
  let events = []
  link2.observeDeep((e) => {
    events = e
  })
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
  const link2 = /** @type {Y.WeakLink<String>} */ (map1.link('link-key'))
  map2.set('link-link', link2)
  const link3 = /** @type {Y.WeakLink<String>} */ (map2.link('link-link'))
  map3.set('link-link-link', link3)

  /**
   * @type {Array<any>}
   */
  let events = []
  link3.observeDeep((e) => {
    events = e
  })
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
  map.observeDeep((es) => {
    events = es.map((e) => {
      return { target: e.target, keys: e.keys }
    })
  })

  const nested = new Y.Map()
  array.insert(0, [nested])
  const link = array.quote(0)
  map.set('link', link)

  // update entry in linked map
  events = []
  nested.set('key', 'value')
  t.compare(events.length, 1)
  t.compare(events[0].target, nested)
  t.compare(events[0].keys, new Map([['key', { action: 'add', oldValue: undefined }]]))

  // delete entry in linked map
  events = []
  nested.delete('key')
  t.compare(events.length, 1)
  t.compare(events[0].target, nested)
  t.compare(events[0].keys, new Map([['key', { action: 'delete', oldValue: 'value' }]]))

  // delete linked map
  array.delete(0)
  t.compare(events.length, 1)
  t.compare(events[0].target, link)
}

/**
 * @param {t.TestCase} tc
 */
export const testDeepObserveArray = tc => { // FIXME
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

  const nested = new Y.Map()
  map.set('nested', nested)
  const link = map.link('nested')
  array.insert(0, [link])

  /**
   * @type {Array<any>}
   */
  let events = []
  array.observeDeep((evts) => {
    events = []
    for (const e of evts) {
      switch (e.constructor) {
        case Y.YMapEvent:
          events.push({ target: e.target, keys: e.keys })
          break
        case Y.YWeakLinkEvent:
          events.push({ target: e.target })
          break
        default: throw new Error('unexpected event type ' + e.constructor)
      }
    }
  })

  // update entry in linked map
  events = []
  nested.set('key', 'value')
  t.compare(events.length, 1)
  t.compare(events[0].target, nested)
  t.compare(events[0].keys, new Map([['key', { action: 'add', oldValue: undefined }]]))

  nested.set('key', 'value2')
  t.compare(events.length, 1)
  t.compare(events[0].target, nested)
  t.compare(events[0].keys, new Map([['key', { action: 'update', oldValue: 'value' }]]))

  // delete entry in linked map
  nested.delete('key')
  t.compare(events.length, 1)
  t.compare(events[0].target, nested)
  t.compare(events[0].keys, new Map([['key', { action: 'delete', oldValue: 'value2' }]]))

  // delete linked map
  map.delete('nested')
  t.compare(events.length, 1)
  t.compare(events[0].target, link)
}

/**
 * @param {t.TestCase} tc
 */
export const testDeepObserveNewElementWithinQuotedRange = tc => {
  const { testConnector, array0, array1 } = init(tc, { users: 2 })
  const m1 = new Y.Map()
  const m3 = new Y.Map()
  array0.insert(0, [1, m1, m3, 2])
  const link0 = array0.quote(1, 2)
  array0.insert(0, [link0])

  testConnector.flushAllMessages()

  /**
   * @type {Array<any>}
   */
  let e0 = []
  link0.observeDeep((evts) => {
    e0 = []
    for (const e of evts) {
      switch (e.constructor) {
        case Y.YMapEvent:
          e0.push({ target: e.target, keys: e.keys })
          break
        case Y.YWeakLinkEvent:
          e0.push({ target: e.target })
          break
        default: throw new Error('unexpected event type ' + e.constructor)
      }
    }
  })

  const link1 = /** @type {Y.WeakLink<any>} */ (array1.get(0))
  /**
   * @type {Array<any>}
   */
  let e1 = []
  link1.observeDeep((evts) => {
    e1 = []
    for (const e of evts) {
      switch (e.constructor) {
        case Y.YMapEvent:
          e1.push({ target: e.target, keys: e.keys })
          break
        case Y.YWeakLinkEvent:
          e1.push({ target: e.target })
          break
        default: throw new Error('unexpected event type ' + e.constructor)
      }
    }
  })

  const m20 = new Y.Map()
  array0.insert(3, [m20])

  m20.set('key', 'value')
  t.compare(e0.length, 1)
  t.compare(e0[0].target, m20)
  t.compare(e0[0].keys, new Map([['key', { action: 'add', oldValue: undefined }]]))

  testConnector.flushAllMessages()

  const m21 = array1.get(3)
  t.compare(e1.length, 1)
  t.compare(e1[0].target, m21)
  t.compare(e1[0].keys, new Map([['key', { action: 'add', oldValue: undefined }]]))
}

/**
 * @param {t.TestCase} tc
 */
export const testMapDeepObserve = tc => { // FIXME
  const doc = new Y.Doc()
  const outer = doc.getMap('outer')
  const inner = new Y.Map()
  outer.set('inner', inner)

  /**
   * @type {Array<any>}
   */
  let events = []
  outer.observeDeep((evts) => {
    events = []
    for (const e of evts) {
      switch (e.constructor) {
        case Y.YMapEvent:
          events.push({ target: e.target, keys: e.keys })
          break
        case Y.YWeakLinkEvent:
          events.push({ target: e.target })
          break
        default: throw new Error('unexpected event type ' + e.constructor)
      }
    }
  })

  inner.set('key', 'value1')
  t.compare(events.length, 1)
  t.compare(events[0].target, inner)
  t.compare(events[0].keys, new Map([['key', { action: 'add', oldValue: undefined }]]))

  events = []
  inner.set('key', 'value2')
  t.compare(events.length, 1)
  t.compare(events[0].target, inner)
  t.compare(events[0].keys, new Map([['key', { action: 'update', oldValue: 'value1' }]]))

  events = []
  inner.delete('key')
  t.compare(events.length, 1)
  t.compare(events[0].target, inner)
  t.compare(events[0].keys, new Map([['key', { action: 'delete', oldValue: 'value2' }]]))
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

  const l0 = root.quote(0)
  const l1 = root.quote(1)
  const l2 = root.quote(2)

  // create cyclic reference between links
  m0.set('k1', l1)
  m1.set('k2', l2)
  m2.set('k0', l0)

  /**
   * @type {Array<any>}
   */
  let events = []
  m0.observeDeep((es) => {
    events = es.map((e) => { 
      return { target: e.target, keys: e.keys }
    })
  })

  m1.set('test-key1', 'value1')
  t.compare(events.length, 1)
  t.compare(events[0].target, m1)
  t.compare(events[0].keys, new Map([['test-key1', { action: 'add', oldValue: undefined }]]))

  events = []
  m2.set('test-key2', 'value2')
  t.compare(events.length, 1)
  t.compare(events[0].target, m2)
  t.compare(events[0].keys, new Map([['test-key2', { action: 'add', oldValue: undefined }]]))

  m1.delete('test-key1')
  t.compare(events.length, 1)
  t.compare(events[0].target, m1)
  t.compare(events[0].keys, new Map([['test-key1', { action: 'delete', oldValue: 'value1' }]]))
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
  Y.applyUpdate(users[2], Y.encodeStateAsUpdate(users[0]))
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

/**
 * @param {t.TestCase} tc
 */
export const testTextBasic = tc => {
  const { testConnector, text0, text1 } = init(tc, { users: 2 })

  text0.insert(0, 'abcd') // 'abcd'
  const link0 = text0.quote(1, 2) // quote: [bc]
  t.compare(link0.toString(), 'bc')
  text0.insert(2, 'ef') // 'abefcd', quote: [befc]
  t.compare(link0.toString(), 'befc')
  text0.delete(3, 3) // 'abe', quote: [be]
  t.compare(link0.toString(), 'be')
  text0.insertEmbed(3, link0) // 'abe[be]'

  testConnector.flushAllMessages()

  const delta = text1.toDelta()
  const { insert } = delta[1] // YWeakLink
  t.compare(insert.toString(), 'be')
}

/**
 * @param {t.TestCase} tc
 */
export const testXmlTextBasic = tc => {
  const { testConnector, xml0, xml1 } = init(tc, { users: 2 })
  const text0 = new Y.XmlText()
  xml0.insert(0, [text0])

  text0.insert(0, 'abcd') // 'abcd'
  const link0 = text0.quote(1, 2) // quote: [bc]
  t.compare(link0.toString(), 'bc')
  text0.insert(2, 'ef') // 'abefcd', quote: [befc]
  t.compare(link0.toString(), 'befc')
  text0.delete(3, 3) // 'abe', quote: [be]
  t.compare(link0.toString(), 'be')
  text0.insertEmbed(3, link0) // 'abe[be]'

  testConnector.flushAllMessages()
  const text1 = /** @type {Y.XmlText} */ (xml1.get(0))
  const delta = text1.toDelta()
  const { insert } = delta[1] // YWeakLink
  t.compare(insert.toString(), 'be')
}
/**
 * @param {t.TestCase} tc
 */
export const testQuoteFormattedText = tc => {
  const doc = new Y.Doc()
  const text = /** @type {Y.XmlText} */ (doc.get('text', Y.XmlText))
  const text2 = /** @type {Y.XmlText} */ (doc.get('text2', Y.XmlText))

  text.insert(0, 'abcde')
  text.format(0, 1, { b: true })
  text.format(1, 3, { i: true }) // '<b>a</b><i>bcd</i>e'
  const l1 = text.quote(0, 2)
  t.compare(l1.toString(), '<b>a</b><i>b</i>')
  const l2 = text.quote(2, 1) // '<i>c</i>'
  t.compare(l2.toString(), '<i>c</i>')
  const l3 = text.quote(3, 2) // '<i>d</i>e'
  t.compare(l3.toString(), '<i>d</i>e')

  text2.insertEmbed(0, l1)
  text2.insertEmbed(1, l2)
  text2.insertEmbed(2, l3)

  const delta = text2.toDelta()
  t.compare(delta, [
    { insert: l1 },
    { insert: l2 },
    { insert: l3 }
  ])
}