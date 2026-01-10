import * as Y from '../src/index.js'
import { init, compare, applyRandomTests, Doc } from './testHelper.js' // eslint-disable-line
import {
  noAttributionsManager,
  TwosetAttributionManager,
  createIdMapFromIdSet
} from '../src/internals.js'
import * as t from 'lib0/testing'
import * as prng from 'lib0/prng'
import * as delta from 'lib0/delta'
import * as s from 'lib0/schema'
import * as object from 'lib0/object'

/**
 * @param {t.TestCase} _tc
 */
export const testIterators = _tc => {
  const ydoc = new Y.Doc()
  /**
   * @type {Y.Type<{attrs: { [k:string]: number} }>}
   */
  const ymap = ydoc.get()
  // we are only checking if the type assumptions are correct
  /**
   * @type {Array<number>}
   */
  const vals = Array.from(ymap.attrValues())
  /**
   * @type {Array<[string,number]>}
   */
  const entries = Array.from(ymap.attrEntries())
  /**
   * @type {Array<string>}
   */
  const keys = Array.from(ymap.attrKeys())
  console.log(vals, entries, keys)
}

export const testNestedMapEvent = () => {
  const ydoc = new Y.Doc()
  const ymap = ydoc.get()
  const ymapNested = ymap.setAttr('nested', new Y.Type())
  let called = 0
  ymap.observeDeep(event => {
    const d = event.deltaDeep
    called++
    t.compare(d, delta.create().modifyAttr('nested', delta.create().setAttr('k', 'v')))
  })
  ymapNested.setAttr('k', 'v')
  t.assert(called === 1)
}

export const testNestedMapEvent2 = () => {
  const ydoc = new Y.Doc()
  const yarr = ydoc.get()
  const ymapNested = new Y.Type()
  yarr.insert(0, [ymapNested])
  let called = 0
  yarr.observeDeep(event => {
    const d = event.deltaDeep
    called++
    t.compare(d, delta.create().modify(delta.create().setAttr('k', 'v')))
  })
  ymapNested.setAttr('k', 'v')
  t.assert(called === 1)
}

/**
 * Computing event changes after transaction should result in an error. See yjs#539
 *
 * @param {t.TestCase} _tc
 */
export const testMapEventError = _tc => {
  const doc = new Y.Doc()
  const ymap = doc.get()
  /**
   * @type {any}
   */
  let event = null
  ymap.observe((e) => {
    event = e
  })
  t.fails(() => {
    t.info(event.keys)
  })
  t.fails(() => {
    t.info(event.keys)
  })
}

/**
 * @param {t.TestCase} tc
 */
export const testMapHavingIterableAsConstructorParamTests = tc => {
  const { map0 } = init(tc, { users: 1 })
  const m1 = Y.Type.from(delta.create().setAttr('number', 1).setAttr('string', 'hello'))
  map0.setAttr('m1', m1)
  t.assert(m1.getAttr('number') === 1)
  t.assert(m1.getAttr('string') === 'hello')
  const m2 = Y.Type.from(delta.create(delta.$deltaAny).setAttrs({ object: { x: 1 }, boolean: true }).done())
  map0.setAttr('m2', m2)
  t.assert(m2.getAttr('object')?.x === 1)
  t.assert(m2.getAttr('boolean') === true)
  const m3 = new Y.Type().applyDelta(m1.getContent()).applyDelta(m2.getContent())
  map0.setAttr('m3', m3)
  t.assert(m3.getAttr('number') === 1)
  t.assert(m3.getAttr('string') === 'hello')
  t.assert(m3.getAttr('object')?.x === 1)
  t.assert(m3.getAttr('boolean') === true)
}

/**
 * @param {t.TestCase} tc
 */
export const testBasicMapTests = tc => {
  const { testConnector, users, map0, map1, map2 } = init(tc, { users: 3 })
  users[2].disconnect()

  map0.setAttr('null', null)
  map0.setAttr('number', 1)
  map0.setAttr('string', 'hello Y')
  map0.setAttr('object', { key: { key2: 'value' } })
  map0.setAttr('y-map', new Y.Type())
  map0.setAttr('boolean1', true)
  map0.setAttr('boolean0', false)
  const map = map0.getAttr('y-map')
  map.setAttr('y-array', new Y.Type())
  const array = map.getAttr('y-array')
  array.insert(0, [0])
  array.insert(0, [-1])

  t.assert(map0.getAttr('null') === null, 'client 0 computed the change (null)')
  t.assert(map0.getAttr('number') === 1, 'client 0 computed the change (number)')
  t.assert(map0.getAttr('string') === 'hello Y', 'client 0 computed the change (string)')
  t.assert(map0.getAttr('boolean0') === false, 'client 0 computed the change (boolean)')
  t.assert(map0.getAttr('boolean1') === true, 'client 0 computed the change (boolean)')
  t.compare(map0.getAttr('object'), { key: { key2: 'value' } }, 'client 0 computed the change (object)')
  t.assert(map0.getAttr('y-map').getAttr('y-array').get(0) === -1, 'client 0 computed the change (type)')
  t.assert(map0.attrSize === 7, 'client 0 map has correct size')

  users[2].connect()
  testConnector.flushAllMessages()

  t.assert(map1.getAttr('null') === null, 'client 1 received the update (null)')
  t.assert(map1.getAttr('number') === 1, 'client 1 received the update (number)')
  t.assert(map1.getAttr('string') === 'hello Y', 'client 1 received the update (string)')
  t.assert(map1.getAttr('boolean0') === false, 'client 1 computed the change (boolean)')
  t.assert(map1.getAttr('boolean1') === true, 'client 1 computed the change (boolean)')
  t.compare(map1.getAttr('object'), { key: { key2: 'value' } }, 'client 1 received the update (object)')
  t.assert(map1.getAttr('y-map').getAttr('y-array').get(0) === -1, 'client 1 received the update (type)')
  t.assert(map1.attrSize === 7, 'client 1 map has correct size')

  // compare disconnected user
  t.assert(map2.getAttr('null') === null, 'client 2 received the update (null) - was disconnected')
  t.assert(map2.getAttr('number') === 1, 'client 2 received the update (number) - was disconnected')
  t.assert(map2.getAttr('string') === 'hello Y', 'client 2 received the update (string) - was disconnected')
  t.assert(map2.getAttr('boolean0') === false, 'client 2 computed the change (boolean)')
  t.assert(map2.getAttr('boolean1') === true, 'client 2 computed the change (boolean)')
  t.compare(map2.getAttr('object'), { key: { key2: 'value' } }, 'client 2 received the update (object) - was disconnected')
  t.assert(map2.getAttr('y-map').getAttr('y-array').get(0) === -1, 'client 2 received the update (type) - was disconnected')
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testGetAndSetOfMapProperty = tc => {
  const { testConnector, users, map0 } = init(tc, { users: 2 })
  map0.setAttr('stuff', 'stuffy')
  map0.setAttr('undefined', undefined)
  map0.setAttr('null', null)
  t.compare(map0.getAttr('stuff'), 'stuffy')

  testConnector.flushAllMessages()

  for (const user of users) {
    const u = user.get('map')
    t.compare(u.getAttr('stuff'), 'stuffy')
    t.assert(u.getAttr('undefined') === undefined, 'undefined')
    t.compare(u.getAttr('null'), null, 'null')
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testYmapSetsYmap = tc => {
  const { users, map0 } = init(tc, { users: 2 })
  const map = map0.setAttr('Map', new Y.Type())
  t.assert(map0.getAttr('Map') === map)
  map.setAttr('one', 1)
  t.compare(map.getAttr('one'), 1)
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testYmapSetsYarray = tc => {
  const { users, map0 } = init(tc, { users: 2 })
  const array = map0.setAttr('Array', new Y.Type())
  t.assert(array === map0.getAttr('Array'))
  array.insert(0, [1, 2, 3])
  // @ts-ignore
  t.compare(map0.toJSON().attrs, { Array: { children: [1, 2, 3] } })
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testGetAndSetOfMapPropertySyncs = tc => {
  const { testConnector, users, map0 } = init(tc, { users: 2 })
  map0.setAttr('stuff', 'stuffy')
  t.compare(map0.getAttr('stuff'), 'stuffy')
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.get('map')
    t.compare(u.getAttr('stuff'), 'stuffy')
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testGetAndSetOfMapPropertyWithConflict = tc => {
  const { testConnector, users, map0, map1 } = init(tc, { users: 3 })
  map0.setAttr('stuff', 'c0')
  map1.setAttr('stuff', 'c1')
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.get('map')
    t.compare(u.getAttr('stuff'), 'c1')
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testSizeAndDeleteOfMapProperty = tc => {
  const { map0 } = init(tc, { users: 1 })
  map0.setAttr('stuff', 'c0')
  map0.setAttr('otherstuff', 'c1')
  t.assert(map0.attrSize === 2, `map size is ${map0.attrSize} expected 2`)
  map0.deleteAttr('stuff')
  t.assert(map0.attrSize === 1, `map size after delete is ${map0.attrSize}, expected 1`)
  map0.deleteAttr('otherstuff')
  t.assert(map0.attrSize === 0, `map size after delete is ${map0.attrSize}, expected 0`)
}

/**
 * @param {t.TestCase} tc
 */
export const testGetAndSetAndDeleteOfMapProperty = tc => {
  const { testConnector, users, map0, map1 } = init(tc, { users: 3 })
  map0.setAttr('stuff', 'c0')
  map1.setAttr('stuff', 'c1')
  map1.deleteAttr('stuff')
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.get('map')
    t.assert(u.getAttr('stuff') === undefined)
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testSetAndClearOfMapProperties = tc => {
  const { testConnector, users, map0 } = init(tc, { users: 1 })
  map0.setAttr('stuff', 'c0')
  map0.setAttr('otherstuff', 'c1')
  map0.clearAttrs()
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.get('map')
    t.assert(u.getAttr('stuff') === undefined)
    t.assert(u.getAttr('otherstuff') === undefined)
    t.assert(u.attrSize === 0, `map size after clear is ${u.attrSize}, expected 0`)
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testSetAndClearOfMapPropertiesWithConflicts = tc => {
  const { testConnector, users, map0, map1, map2, map3 } = init(tc, { users: 4 })
  map0.setAttr('stuff', 'c0')
  map1.setAttr('stuff', 'c1')
  map1.setAttr('stuff', 'c2')
  map2.setAttr('stuff', 'c3')
  testConnector.flushAllMessages()
  map0.setAttr('otherstuff', 'c0')
  map1.setAttr('otherstuff', 'c1')
  map2.setAttr('otherstuff', 'c2')
  map3.setAttr('otherstuff', 'c3')
  map3.clearAttrs()
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.get('map')
    t.assert(u.getAttr('stuff') === undefined)
    t.assert(u.getAttr('otherstuff') === undefined)
    t.assert(u.attrSize === 0, `map size after clear is ${u.attrSize}, expected 0`)
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testGetAndSetOfMapPropertyWithThreeConflicts = tc => {
  const { testConnector, users, map0, map1, map2 } = init(tc, { users: 3 })
  map0.setAttr('stuff', 'c0')
  map1.setAttr('stuff', 'c1')
  map1.setAttr('stuff', 'c2')
  map2.setAttr('stuff', 'c3')
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.get('map')
    t.compare(u.getAttr('stuff'), 'c3')
  }
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testGetAndSetAndDeleteOfMapPropertyWithThreeConflicts = tc => {
  const { testConnector, users, map0, map1, map2, map3 } = init(tc, { users: 4 })
  map0.setAttr('stuff', 'c0')
  map1.setAttr('stuff', 'c1')
  map1.setAttr('stuff', 'c2')
  map2.setAttr('stuff', 'c3')
  testConnector.flushAllMessages()
  map0.setAttr('stuff', 'deleteme')
  map1.setAttr('stuff', 'c1')
  map2.setAttr('stuff', 'c2')
  map3.setAttr('stuff', 'c3')
  map3.deleteAttr('stuff')
  testConnector.flushAllMessages()
  for (const user of users) {
    const u = user.get('map')
    t.assert(u.getAttr('stuff') === undefined)
  }
  compare(users)
}

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
  map0.setAttr('stuff', 4)
  compareEvent(event, {
    target: map0,
    keysChanged: new Set(['stuff'])
  })
  // update, oldValue is in contents
  map0.setAttr('stuff', new Y.Type())
  compareEvent(event, {
    target: map0,
    keysChanged: new Set(['stuff'])
  })
  // update, oldValue is in opContents
  map0.setAttr('stuff', 5)
  // delete
  map0.deleteAttr('stuff')
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
  map0.setAttr('stuff', 4)
  map0.setAttr('otherstuff', new Y.Type())
  // clear
  map0.clearAttrs()
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
   * @type {delta.Delta<any>?}
   */
  let changes = delta.create()
  map0.observe(e => {
    changes = e.delta
  })
  map0.setAttr('a', 1)
  let keyChange = changes.attrs.a
  t.assert(delta.$setAttrOpWith(s.$number).check(keyChange) && keyChange.prevValue === undefined)
  map0.setAttr('a', 2)
  keyChange = changes.attrs.a
  t.assert(delta.$setAttrOpWith(s.$number).check(keyChange) && keyChange.prevValue === 1)
  users[0].transact(() => {
    map0.setAttr('a', 3)
    map0.setAttr('a', 4)
  })
  keyChange = changes.attrs.a
  t.assert(delta.$setAttrOpWith(s.$number).check(keyChange) && keyChange.prevValue === 2)
  users[0].transact(() => {
    map0.setAttr('b', 1)
    map0.setAttr('b', 2)
  })
  keyChange = changes.attrs.b
  t.assert(delta.$setAttrOpWith(s.$number).check(keyChange) && keyChange.prevValue === undefined)
  users[0].transact(() => {
    map0.setAttr('c', 1)
    map0.deleteAttr('c')
  })
  t.assert(changes !== null && object.isEmpty(changes.attrs))
  users[0].transact(() => {
    map0.setAttr('d', 1)
    map0.setAttr('d', 2)
  })
  keyChange = changes.attrs.d
  t.assert(delta.$setAttrOpWith(s.$number).check(keyChange) && keyChange.prevValue === undefined)
  compare(users)
}

/**
 * @param {t.TestCase} _tc
 */
export const testYmapEventExceptionsShouldCompleteTransaction = _tc => {
  const doc = new Y.Doc()
  const map = doc.get('map')

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
    map.setAttr('y', '2')
  })

  t.assert(updateCalled)
  t.assert(throwingObserverCalled)
  t.assert(throwingDeepObserverCalled)

  // check if it works again
  updateCalled = false
  throwingObserverCalled = false
  throwingDeepObserverCalled = false
  t.fails(() => {
    map.setAttr('z', '3')
  })

  t.assert(updateCalled)
  t.assert(throwingObserverCalled)
  t.assert(throwingDeepObserverCalled)

  t.assert(map.getAttr('z') === '3')
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
  map0.setAttr('stuff', 2)
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
  map1.setAttr('stuff', 2)
  testConnector.flushAllMessages()
  t.compare(event.value, event.target.get(event.name))
  compare(users)
}

/**
 * @param {t.TestCase} _tc
 */
export const testAttributedContent = _tc => {
  const ydoc = new Y.Doc({ gc: false })
  const ymap = ydoc.get()
  let attributionManager = noAttributionsManager

  ydoc.on('afterTransaction', tr => {
    // attributionManager = new TwosetAttributionManager(createIdMapFromIdSet(tr.insertSet, [new Y.Attribution('insertedAt', 42), new Y.Attribution('insert', 'kevin')]), createIdMapFromIdSet(tr.deleteSet, [new Y.Attribution('delete', 'kevin')]))
    attributionManager = new TwosetAttributionManager(createIdMapFromIdSet(tr.insertSet, []), createIdMapFromIdSet(tr.deleteSet, []))
  })
  t.group('initial value', () => {
    ymap.setAttr('test', 42)
    const expectedContent = { test: delta.$deltaMapChangeJson.expect({ type: 'insert', value: 42, attribution: { insert: [] } }) }
    const attributedContent = ymap.getContent(attributionManager)
    console.log(attributedContent.toJSON())
    t.compare(expectedContent, attributedContent.toJSON().attrs)
  })
  t.group('overwrite value', () => {
    ymap.setAttr('test', 'fourtytwo')
    const expectedContent = { test: delta.$deltaMapChangeJson.expect({ type: 'insert', value: 'fourtytwo', attribution: { insert: [] } }) }
    const attributedContent = ymap.getContent(attributionManager)
    console.log(attributedContent)
    t.compare(expectedContent, attributedContent.toJSON().attrs)
  })
  t.group('delete value', () => {
    ymap.deleteAttr('test')
    const expectedContent = { test: delta.$deltaMapChangeJson.expect({ type: 'delete', prevValue: 'fourtytwo', attribution: { delete: [] } }) }
    const attributedContent = ymap.getContent(attributionManager)
    console.log(attributedContent.toJSON())
    t.compare(expectedContent, attributedContent.toJSON().attrs)
  })
}

/**
 * @type {Array<function(Doc,prng.PRNG):void>}
 */
const mapTransactions = [
  function set (user, gen) {
    const key = prng.oneOf(gen, ['one', 'two'])
    const value = prng.utf16String(gen)
    user.get('map').setAttr(key, value)
  },
  function setType (user, gen) {
    const key = prng.oneOf(gen, ['one', 'two'])
    const type = new Y.Type()
    user.get('map').setAttr(key, type)
    if (prng.bool(gen)) {
      type.insert(0, [1, 2, 3, 4])
    } else {
      type.setAttr('deepkey', 'deepvalue')
    }
  },
  function _delete (user, gen) {
    const key = prng.oneOf(gen, ['one', 'two'])
    user.get('map').deleteAttr(key)
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
