import { init, compare, applyRandomTests, Doc } from './testHelper.js' // eslint-disable-line

import {
  compareIDs
} from '../src/internals.js'

import * as Y from '../src/index.js'
import * as t from 'lib0/testing'
import * as prng from 'lib0/prng'

/**
 * @param {t.TestCase} tc
 */
export const testMapHavingIterableAsConstructorParamTests = tc => {
  const { map0 } = init(tc, { users: 1 })

  const m1 = new Y.Map(Object.entries({ number: 1, string: 'hello' }))
  map0.set('m1', m1)
  t.assert(m1.get('number') === 1)
  t.assert(m1.get('string') === 'hello')

  const m2 = new Y.Map([
    ['object', { x: 1 }],
    ['boolean', true]
  ])
  map0.set('m2', m2)
  t.assert(m2.get('object').x === 1)
  t.assert(m2.get('boolean') === true)

  const m3 = new Y.Map([...m1, ...m2])
  map0.set('m3', m3)
  t.assert(m3.get('number') === 1)
  t.assert(m3.get('string') === 'hello')
  t.assert(m3.get('object').x === 1)
  t.assert(m3.get('boolean') === true)
}

/**
 * @param {t.TestCase} tc
 */
export const testBasicMapTests = tc => {
  const { testConnector, users, map0, map1, map2 } = init(tc, { users: 3 })
  users[2].disconnect()

  map0.set('null', null)
  map0.set('number', 1)
  map0.set('string', 'hello Y')
  map0.set('object', { key: { key2: 'value' } })
  map0.set('y-map', new Y.Map())
  map0.set('boolean1', true)
  map0.set('boolean0', false)
  const map = map0.get('y-map')
  map.set('y-array', new Y.Array())
  const array = map.get('y-array')
  array.insert(0, [0])
  array.insert(0, [-1])

  t.assert(map0.get('null') === null, 'client 0 computed the change (null)')
  t.assert(map0.get('number') === 1, 'client 0 computed the change (number)')
  t.assert(map0.get('string') === 'hello Y', 'client 0 computed the change (string)')
  t.assert(map0.get('boolean0') === false, 'client 0 computed the change (boolean)')
  t.assert(map0.get('boolean1') === true, 'client 0 computed the change (boolean)')
  t.compare(map0.get('object'), { key: { key2: 'value' } }, 'client 0 computed the change (object)')
  t.assert(map0.get('y-map').get('y-array').get(0) === -1, 'client 0 computed the change (type)')
  t.assert(map0.size === 7, 'client 0 map has correct size')

  users[2].connect()
  testConnector.flushAllMessages()

  t.assert(map1.get('null') === null, 'client 1 received the update (null)')
  t.assert(map1.get('number') === 1, 'client 1 received the update (number)')
  t.assert(map1.get('string') === 'hello Y', 'client 1 received the update (string)')
  t.assert(map1.get('boolean0') === false, 'client 1 computed the change (boolean)')
  t.assert(map1.get('boolean1') === true, 'client 1 computed the change (boolean)')
  t.compare(map1.get('object'), { key: { key2: 'value' } }, 'client 1 received the update (object)')
  t.assert(map1.get('y-map').get('y-array').get(0) === -1, 'client 1 received the update (type)')
  t.assert(map1.size === 7, 'client 1 map has correct size')

  // compare disconnected user
  t.assert(map2.get('null') === null, 'client 2 received the update (null) - was disconnected')
  t.assert(map2.get('number') === 1, 'client 2 received the update (number) - was disconnected')
  t.assert(map2.get('string') === 'hello Y', 'client 2 received the update (string) - was disconnected')
  t.assert(map2.get('boolean0') === false, 'client 2 computed the change (boolean)')
  t.assert(map2.get('boolean1') === true, 'client 2 computed the change (boolean)')
  t.compare(map2.get('object'), { key: { key2: 'value' } }, 'client 2 received the update (object) - was disconnected')
  t.assert(map2.get('y-map').get('y-array').get(0) === -1, 'client 2 received the update (type) - was disconnected')
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testGetAndSetOfMapProperty = tc => {
  const { testConnector, users, map0 } = init(tc, { users: 2 })
  map0.set('stuff', 'stuffy')
  map0.set('undefined', undefined)
  map0.set('null', null)
  t.compare(map0.get('stuff'), 'stuffy')

  testConnector.flushAllMessages()

  for (const user of users) {
    const u = user.getMap('map')
    t.compare(u.get('stuff'), 'stuffy')
    t.assert(u.get('undefined') === undefined, 'undefined')
    t.compare(u.get('null'), null, 'null')
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testYmapSetsYmap = tc => {
  const { users, map0 } = init(tc, { users: 2 })
  const map = map0.set('Map', new Y.Map())
  t.assert(map0.get('Map') === map)
  map.set('one', 1)
  t.compare(map.get('one'), 1)
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testYmapSetsYarray = tc => {
  const { users, map0 } = init(tc, { users: 2 })
  const array = map0.set('Array', new Y.Array())
  t.assert(array === map0.get('Array'))
  array.insert(0, [1, 2, 3])
  // @ts-ignore
  t.compare(map0.toJSON(), { Array: [1, 2, 3] })
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testGetAndSetOfMapPropertySyncs = tc => {
  const { testConnector, users, map0 } = init(tc, { users: 2 })
  map0.set('stuff', 'stuffy')
  t.compare(map0.get('stuff'), 'stuffy')
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.getMap('map')
    t.compare(u.get('stuff'), 'stuffy')
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testGetAndSetOfMapPropertyWithConflict = tc => {
  const { testConnector, users, map0, map1 } = init(tc, { users: 3 })
  map0.set('stuff', 'c0')
  map1.set('stuff', 'c1')
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.getMap('map')
    t.compare(u.get('stuff'), 'c1')
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testSizeAndDeleteOfMapProperty = tc => {
  const { map0 } = init(tc, { users: 1 })
  map0.set('stuff', 'c0')
  map0.set('otherstuff', 'c1')
  t.assert(map0.size === 2, `map size is ${map0.size} expected 2`)
  map0.delete('stuff')
  t.assert(map0.size === 1, `map size after delete is ${map0.size}, expected 1`)
  map0.delete('otherstuff')
  t.assert(map0.size === 0, `map size after delete is ${map0.size}, expected 0`)
}

/**
 * @param {t.TestCase} tc
 */
export const testGetAndSetAndDeleteOfMapProperty = tc => {
  const { testConnector, users, map0, map1 } = init(tc, { users: 3 })
  map0.set('stuff', 'c0')
  map1.set('stuff', 'c1')
  map1.delete('stuff')
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.getMap('map')
    t.assert(u.get('stuff') === undefined)
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testSetAndClearOfMapProperties = tc => {
  const { testConnector, users, map0 } = init(tc, { users: 1 })
  map0.set('stuff', 'c0')
  map0.set('otherstuff', 'c1')
  map0.clear()
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.getMap('map')
    t.assert(u.get('stuff') === undefined)
    t.assert(u.get('otherstuff') === undefined)
    t.assert(u.size === 0, `map size after clear is ${u.size}, expected 0`)
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testSetAndClearOfMapPropertiesWithConflicts = tc => {
  const { testConnector, users, map0, map1, map2, map3 } = init(tc, { users: 4 })
  map0.set('stuff', 'c0')
  map1.set('stuff', 'c1')
  map1.set('stuff', 'c2')
  map2.set('stuff', 'c3')
  testConnector.flushAllMessages()
  map0.set('otherstuff', 'c0')
  map1.set('otherstuff', 'c1')
  map2.set('otherstuff', 'c2')
  map3.set('otherstuff', 'c3')
  map3.clear()
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.getMap('map')
    t.assert(u.get('stuff') === undefined)
    t.assert(u.get('otherstuff') === undefined)
    t.assert(u.size === 0, `map size after clear is ${u.size}, expected 0`)
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testGetAndSetOfMapPropertyWithThreeConflicts = tc => {
  const { testConnector, users, map0, map1, map2 } = init(tc, { users: 3 })
  map0.set('stuff', 'c0')
  map1.set('stuff', 'c1')
  map1.set('stuff', 'c2')
  map2.set('stuff', 'c3')
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.getMap('map')
    t.compare(u.get('stuff'), 'c3')
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testGetAndSetAndDeleteOfMapPropertyWithThreeConflicts = tc => {
  const { testConnector, users, map0, map1, map2, map3 } = init(tc, { users: 4 })
  map0.set('stuff', 'c0')
  map1.set('stuff', 'c1')
  map1.set('stuff', 'c2')
  map2.set('stuff', 'c3')
  testConnector.flushAllMessages()
  map0.set('stuff', 'deleteme')
  map1.set('stuff', 'c1')
  map2.set('stuff', 'c2')
  map3.set('stuff', 'c3')
  map3.delete('stuff')
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.getMap('map')
    t.assert(u.get('stuff') === undefined)
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testObserveDeepProperties = tc => {
  const { testConnector, users, map1, map2, map3 } = init(tc, { users: 4 })
  const _map1 = map1.set('map', new Y.Map())
  let calls = 0
  let dmapid
  map1.observeDeep(events => {
    events.forEach(event => {
      calls++
      // @ts-ignore
      t.assert(event.keysChanged.has('deepmap'))
      t.assert(event.path.length === 1)
      t.assert(event.path[0] === 'map')
      // @ts-ignore
      dmapid = event.target.get('deepmap')._item.id
    })
  })
  testConnector.flushAllMessages()
  const _map3 = map3.get('map')
  _map3.set('deepmap', new Y.Map())
  testConnector.flushAllMessages()
  const _map2 = map2.get('map')
  _map2.set('deepmap', new Y.Map())
  testConnector.flushAllMessages()
  const dmap1 = _map1.get('deepmap')
  const dmap2 = _map2.get('deepmap')
  const dmap3 = _map3.get('deepmap')
  t.assert(calls > 0)
  t.assert(compareIDs(dmap1._item.id, dmap2._item.id))
  t.assert(compareIDs(dmap1._item.id, dmap3._item.id))
  // @ts-ignore we want the possibility of dmapid being undefined
  t.assert(compareIDs(dmap1._item.id, dmapid))
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testObserversUsingObservedeep = tc => {
  const { users, map0 } = init(tc, { users: 2 })
  /**
   * @type {Array<Array<string|number>>}
   */
  const pathes = []
  let calls = 0
  map0.observeDeep(events => {
    events.forEach(event => {
      pathes.push(event.path)
    })
    calls++
  })
  map0.set('map', new Y.Map())
  map0.get('map').set('array', new Y.Array())
  map0.get('map').get('array').insert(0, ['content'])
  t.assert(calls === 3)
  t.compare(pathes, [[], ['map'], ['map', 'array']])
  compare(users)
}

// TODO: Test events in Y.Map
/**
 * @param {Object<string,any>} is
 * @param {Object<string,any>} should
 */
const compareEvent = (is, should) => {
  for (const key in should) {
    t.compare(should[key], is[key])
  }
}

/**
 * @param {t.TestCase} tc
 */
export const testThrowsAddAndUpdateAndDeleteEvents = tc => {
  const { users, map0 } = init(tc, { users: 2 })
  /**
   * @type {Object<string,any>}
   */
  let event = {}
  map0.observe(e => {
    event = e // just put it on event, should be thrown synchronously anyway
  })
  map0.set('stuff', 4)
  compareEvent(event, {
    target: map0,
    keysChanged: new Set(['stuff'])
  })
  // update, oldValue is in contents
  map0.set('stuff', new Y.Array())
  compareEvent(event, {
    target: map0,
    keysChanged: new Set(['stuff'])
  })
  // update, oldValue is in opContents
  map0.set('stuff', 5)
  // delete
  map0.delete('stuff')
  compareEvent(event, {
    keysChanged: new Set(['stuff']),
    target: map0
  })
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testThrowsDeleteEventsOnClear = tc => {
  const { users, map0 } = init(tc, { users: 2 })
  /**
   * @type {Object<string,any>}
   */
  let event = {}
  map0.observe(e => {
    event = e // just put it on event, should be thrown synchronously anyway
  })
  // set values
  map0.set('stuff', 4)
  map0.set('otherstuff', new Y.Array())
  // clear
  map0.clear()
  compareEvent(event, {
    keysChanged: new Set(['stuff', 'otherstuff']),
    target: map0
  })
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testChangeEvent = tc => {
  const { map0, users } = init(tc, { users: 2 })
  /**
   * @type {any}
   */
  let changes = null
  /**
   * @type {any}
   */
  let keyChange = null
  map0.observe(e => {
    changes = e.changes
  })
  map0.set('a', 1)
  keyChange = changes.keys.get('a')
  t.assert(changes !== null && keyChange.action === 'add' && keyChange.oldValue === undefined)
  map0.set('a', 2)
  keyChange = changes.keys.get('a')
  t.assert(changes !== null && keyChange.action === 'update' && keyChange.oldValue === 1)
  users[0].transact(() => {
    map0.set('a', 3)
    map0.set('a', 4)
  })
  keyChange = changes.keys.get('a')
  t.assert(changes !== null && keyChange.action === 'update' && keyChange.oldValue === 2)
  users[0].transact(() => {
    map0.set('b', 1)
    map0.set('b', 2)
  })
  keyChange = changes.keys.get('b')
  t.assert(changes !== null && keyChange.action === 'add' && keyChange.oldValue === undefined)
  users[0].transact(() => {
    map0.set('c', 1)
    map0.delete('c')
  })
  t.assert(changes !== null && changes.keys.size === 0)
  users[0].transact(() => {
    map0.set('d', 1)
    map0.set('d', 2)
  })
  keyChange = changes.keys.get('d')
  t.assert(changes !== null && keyChange.action === 'add' && keyChange.oldValue === undefined)
  compare(users)
}

/**
 * @param {t.TestCase} _tc
 */
export const testYmapEventExceptionsShouldCompleteTransaction = _tc => {
  const doc = new Y.Doc()
  const map = doc.getMap('map')

  let updateCalled = false
  let throwingObserverCalled = false
  let throwingDeepObserverCalled = false
  doc.on('update', () => {
    updateCalled = true
  })

  const throwingObserver = () => {
    throwingObserverCalled = true
    throw new Error('Failure')
  }

  const throwingDeepObserver = () => {
    throwingDeepObserverCalled = true
    throw new Error('Failure')
  }

  map.observe(throwingObserver)
  map.observeDeep(throwingDeepObserver)

  t.fails(() => {
    map.set('y', '2')
  })

  t.assert(updateCalled)
  t.assert(throwingObserverCalled)
  t.assert(throwingDeepObserverCalled)

  // check if it works again
  updateCalled = false
  throwingObserverCalled = false
  throwingDeepObserverCalled = false
  t.fails(() => {
    map.set('z', '3')
  })

  t.assert(updateCalled)
  t.assert(throwingObserverCalled)
  t.assert(throwingDeepObserverCalled)

  t.assert(map.get('z') === '3')
}

/**
 * @param {t.TestCase} tc
 */
export const testYmapEventHasCorrectValueWhenSettingAPrimitive = tc => {
  const { users, map0 } = init(tc, { users: 3 })
  /**
   * @type {Object<string,any>}
   */
  let event = {}
  map0.observe(e => {
    event = e
  })
  map0.set('stuff', 2)
  t.compare(event.value, event.target.get(event.name))
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testYmapEventHasCorrectValueWhenSettingAPrimitiveFromOtherUser = tc => {
  const { users, map0, map1, testConnector } = init(tc, { users: 3 })
  /**
   * @type {Object<string,any>}
   */
  let event = {}
  map0.observe(e => {
    event = e
  })
  map1.set('stuff', 2)
  testConnector.flushAllMessages()
  t.compare(event.value, event.target.get(event.name))
  compare(users)
}

/**
 * @type {Array<function(Doc,prng.PRNG):void>}
 */
const mapTransactions = [
  function set (user, gen) {
    const key = prng.oneOf(gen, ['one', 'two'])
    const value = prng.utf16String(gen)
    user.getMap('map').set(key, value)
  },
  function setType (user, gen) {
    const key = prng.oneOf(gen, ['one', 'two'])
    const type = prng.oneOf(gen, [new Y.Array(), new Y.Map()])
    user.getMap('map').set(key, type)
    if (type instanceof Y.Array) {
      type.insert(0, [1, 2, 3, 4])
    } else {
      type.set('deepkey', 'deepvalue')
    }
  },
  function _delete (user, gen) {
    const key = prng.oneOf(gen, ['one', 'two'])
    user.getMap('map').delete(key)
  }
]

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests10 = tc => {
  applyRandomTests(tc, mapTransactions, 3)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests40 = tc => {
  applyRandomTests(tc, mapTransactions, 40)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests42 = tc => {
  applyRandomTests(tc, mapTransactions, 42)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests43 = tc => {
  applyRandomTests(tc, mapTransactions, 43)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests44 = tc => {
  applyRandomTests(tc, mapTransactions, 44)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests45 = tc => {
  applyRandomTests(tc, mapTransactions, 45)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests46 = tc => {
  applyRandomTests(tc, mapTransactions, 46)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests300 = tc => {
  applyRandomTests(tc, mapTransactions, 300)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests400 = tc => {
  applyRandomTests(tc, mapTransactions, 400)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests500 = tc => {
  applyRandomTests(tc, mapTransactions, 500)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests600 = tc => {
  applyRandomTests(tc, mapTransactions, 600)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests1000 = tc => {
  applyRandomTests(tc, mapTransactions, 1000)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests1800 = tc => {
  applyRandomTests(tc, mapTransactions, 1800)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests5000 = tc => {
  t.skip(!t.production)
  applyRandomTests(tc, mapTransactions, 5000)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests10000 = tc => {
  t.skip(!t.production)
  applyRandomTests(tc, mapTransactions, 10000)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYmapTests100000 = tc => {
  t.skip(!t.production)
  applyRandomTests(tc, mapTransactions, 100000)
}
