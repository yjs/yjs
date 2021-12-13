import { init, compare, applyRandomTests, Doc, AbstractType, TestConnector } from './testHelper.js' // eslint-disable-line

import * as Y from '../src/index.js'
import * as t from 'lib0/testing'
import * as prng from 'lib0/prng'
import * as math from 'lib0/math'

/**
 * @param {t.TestCase} tc
 */
export const testBasicUpdate = tc => {
  const doc1 = new Y.Doc()
  const doc2 = new Y.Doc()
  doc1.getArray('array').insert(0, ['hi'])
  const update = Y.encodeStateAsUpdate(doc1)
  Y.applyUpdate(doc2, update)
  t.compare(doc2.getArray('array').toArray(), ['hi'])
}

/**
 * @param {t.TestCase} tc
 */
export const testSlice = tc => {
  const doc1 = new Y.Doc()
  const arr = doc1.getArray('array')
  arr.insert(0, [1, 2, 3])
  t.compareArrays(arr.slice(0), [1, 2, 3])
  t.compareArrays(arr.slice(1), [2, 3])
  t.compareArrays(arr.slice(0, -1), [1, 2])
  arr.insert(0, [0])
  t.compareArrays(arr.slice(0), [0, 1, 2, 3])
  t.compareArrays(arr.slice(0, 2), [0, 1])
}

/**
 * Debugging yjs#297 - a critical bug connected to the search-marker approach
 *
 * @param {t.TestCase} tc
 */
export const testLengthIssue = tc => {
  const doc1 = new Y.Doc()
  const arr = doc1.getArray('array')
  arr.push([0, 1, 2, 3])
  arr.delete(0)
  arr.insert(0, [0])
  t.assert(arr.length === arr.toArray().length)
  doc1.transact(() => {
    arr.delete(1)
    t.assert(arr.length === arr.toArray().length)
    arr.insert(1, [1])
    t.assert(arr.length === arr.toArray().length)
    arr.delete(2)
    t.assert(arr.length === arr.toArray().length)
    arr.insert(2, [2])
    t.assert(arr.length === arr.toArray().length)
  })
  t.assert(arr.length === arr.toArray().length)
  arr.delete(1)
  t.assert(arr.length === arr.toArray().length)
  arr.insert(1, [1])
  t.assert(arr.length === arr.toArray().length)
}

/**
 * Debugging yjs#314
 *
 * @param {t.TestCase} tc
 */
export const testLengthIssue2 = tc => {
  const doc = new Y.Doc()
  const next = doc.getArray()
  doc.transact(() => {
    next.insert(0, ['group2'])
  })
  doc.transact(() => {
    next.insert(1, ['rectangle3'])
  })
  doc.transact(() => {
    next.delete(0)
    next.insert(0, ['rectangle3'])
  })
  next.delete(1)
  doc.transact(() => {
    next.insert(1, ['ellipse4'])
  })
  doc.transact(() => {
    next.insert(2, ['ellipse3'])
  })
  doc.transact(() => {
    next.insert(3, ['ellipse2'])
  })
  doc.transact(() => {
    doc.transact(() => {
      t.fails(() => {
        next.insert(5, ['rectangle2'])
      })
      next.insert(4, ['rectangle2'])
    })
    doc.transact(() => {
      // this should not throw an error message
      next.delete(4)
    })
  })
  console.log(next.toArray())
}

/**
 * @param {t.TestCase} tc
 */
export const testDeleteInsert = tc => {
  const { users, array0 } = init(tc, { users: 2 })
  array0.delete(0, 0)
  t.describe('Does not throw when deleting zero elements with position 0')
  t.fails(() => {
    array0.delete(1, 1)
  })
  array0.insert(0, ['A'])
  array0.delete(1, 0)
  t.describe('Does not throw when deleting zero elements with valid position 1')
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testInsertThreeElementsTryRegetProperty = tc => {
  const { testConnector, users, array0, array1 } = init(tc, { users: 2 })
  array0.insert(0, [1, true, false])
  t.compare(array0.toJSON(), [1, true, false], '.toJSON() works')
  testConnector.flushAllMessages()
  t.compare(array1.toJSON(), [1, true, false], '.toJSON() works after sync')
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testConcurrentInsertWithThreeConflicts = tc => {
  const { users, array0, array1, array2 } = init(tc, { users: 3 })
  array0.insert(0, [0])
  array1.insert(0, [1])
  array2.insert(0, [2])
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testConcurrentInsertDeleteWithThreeConflicts = tc => {
  const { testConnector, users, array0, array1, array2 } = init(tc, { users: 3 })
  array0.insert(0, ['x', 'y', 'z'])
  testConnector.flushAllMessages()
  array0.insert(1, [0])
  array1.delete(0)
  array1.delete(1, 1)
  array2.insert(1, [2])
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testInsertionsInLateSync = tc => {
  const { testConnector, users, array0, array1, array2 } = init(tc, { users: 3 })
  array0.insert(0, ['x', 'y'])
  testConnector.flushAllMessages()
  users[1].disconnect()
  users[2].disconnect()
  array0.insert(1, ['user0'])
  array1.insert(1, ['user1'])
  array2.insert(1, ['user2'])
  users[1].connect()
  users[2].connect()
  testConnector.flushAllMessages()
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testDisconnectReallyPreventsSendingMessages = tc => {
  const { testConnector, users, array0, array1 } = init(tc, { users: 3 })
  array0.insert(0, ['x', 'y'])
  testConnector.flushAllMessages()
  users[1].disconnect()
  users[2].disconnect()
  array0.insert(1, ['user0'])
  array1.insert(1, ['user1'])
  t.compare(array0.toJSON(), ['x', 'user0', 'y'])
  t.compare(array1.toJSON(), ['x', 'user1', 'y'])
  users[1].connect()
  users[2].connect()
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testDeletionsInLateSync = tc => {
  const { testConnector, users, array0, array1 } = init(tc, { users: 2 })
  array0.insert(0, ['x', 'y'])
  testConnector.flushAllMessages()
  users[1].disconnect()
  array1.delete(1, 1)
  array0.delete(0, 2)
  users[1].connect()
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testInsertThenMergeDeleteOnSync = tc => {
  const { testConnector, users, array0, array1 } = init(tc, { users: 2 })
  array0.insert(0, ['x', 'y', 'z'])
  testConnector.flushAllMessages()
  users[0].disconnect()
  array1.delete(0, 3)
  users[0].connect()
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testInsertAndDeleteEvents = tc => {
  const { array0, users } = init(tc, { users: 2 })
  /**
   * @type {Object<string,any>?}
   */
  let event = null
  array0.observe(e => {
    event = e
  })
  array0.insert(0, [0, 1, 2])
  t.assert(event !== null)
  event = null
  array0.delete(0)
  t.assert(event !== null)
  event = null
  array0.delete(0, 2)
  t.assert(event !== null)
  event = null
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testNestedObserverEvents = tc => {
  const { array0, users } = init(tc, { users: 2 })
  /**
   * @type {Array<number>}
   */
  const vals = []
  array0.observe(e => {
    if (array0.length === 1) {
      // inserting, will call this observer again
      // we expect that this observer is called after this event handler finishedn
      array0.insert(1, [1])
      vals.push(0)
    } else {
      // this should be called the second time an element is inserted (above case)
      vals.push(1)
    }
  })
  array0.insert(0, [0])
  t.compareArrays(vals, [0, 1])
  t.compareArrays(array0.toArray(), [0, 1])
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testInsertAndDeleteEventsForTypes = tc => {
  const { array0, users } = init(tc, { users: 2 })
  /**
   * @type {Object<string,any>|null}
   */
  let event = null
  array0.observe(e => {
    event = e
  })
  array0.insert(0, [new Y.Array()])
  t.assert(event !== null)
  event = null
  array0.delete(0)
  t.assert(event !== null)
  event = null
  compare(users)
}

/**
 * This issue has been reported in https://discuss.yjs.dev/t/order-in-which-events-yielded-by-observedeep-should-be-applied/261/2
 *
 * Deep observers generate multiple events. When an array added at item at, say, position 0,
 * and item 1 changed then the array-add event should fire first so that the change event
 * path is correct. A array binding might lead to an inconsistent state otherwise.
 *
 * @param {t.TestCase} tc
 */
export const testObserveDeepEventOrder = tc => {
  const { array0, users } = init(tc, { users: 2 })
  /**
   * @type {Array<any>}
   */
  let events = []
  array0.observeDeep(e => {
    events = e
  })
  array0.insert(0, [new Y.Map()])
  users[0].transact(() => {
    array0.get(0).set('a', 'a')
    array0.insert(0, [0])
  })
  for (let i = 1; i < events.length; i++) {
    t.assert(events[i - 1].path.length <= events[i].path.length, 'path size increases, fire top-level events first')
  }
}

/**
 * @param {t.TestCase} tc
 */
export const testChangeEvent = tc => {
  const { array0, users } = init(tc, { users: 2 })
  /**
   * @type {any}
   */
  let changes = null
  array0.observe(e => {
    changes = e.changes
  })
  const newArr = new Y.Array()
  array0.insert(0, [newArr, 4, 'dtrn'])
  t.assert(changes !== null && changes.added.size === 2 && changes.deleted.size === 0)
  t.compare(changes.delta, [{ insert: [newArr, 4, 'dtrn'] }])
  changes = null
  array0.delete(0, 2)
  t.assert(changes !== null && changes.added.size === 0 && changes.deleted.size === 2)
  t.compare(changes.delta, [{ delete: 2 }])
  changes = null
  array0.insert(1, [0.1])
  t.assert(changes !== null && changes.added.size === 1 && changes.deleted.size === 0)
  t.compare(changes.delta, [{ retain: 1 }, { insert: [0.1] }])
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testInsertAndDeleteEventsForTypes2 = tc => {
  const { array0, users } = init(tc, { users: 2 })
  /**
   * @type {Array<Object<string,any>>}
   */
  const events = []
  array0.observe(e => {
    events.push(e)
  })
  array0.insert(0, ['hi', new Y.Map()])
  t.assert(events.length === 1, 'Event is triggered exactly once for insertion of two elements')
  array0.delete(1)
  t.assert(events.length === 2, 'Event is triggered exactly once for deletion')
  compare(users)
}

/**
 * This issue has been reported here https://github.com/yjs/yjs/issues/155
 * @param {t.TestCase} tc
 */
export const testNewChildDoesNotEmitEventInTransaction = tc => {
  const { array0, users } = init(tc, { users: 2 })
  let fired = false
  users[0].transact(() => {
    const newMap = new Y.Map()
    newMap.observe(() => {
      fired = true
    })
    array0.insert(0, [newMap])
    newMap.set('tst', 42)
  })
  t.assert(!fired, 'Event does not trigger')
}

/**
 * @param {t.TestCase} tc
 */
export const testGarbageCollector = tc => {
  const { testConnector, users, array0 } = init(tc, { users: 3 })
  array0.insert(0, ['x', 'y', 'z'])
  testConnector.flushAllMessages()
  users[0].disconnect()
  array0.delete(0, 3)
  users[0].connect()
  testConnector.flushAllMessages()
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testEventTargetIsSetCorrectlyOnLocal = tc => {
  const { array0, users } = init(tc, { users: 3 })
  /**
   * @type {any}
   */
  let event
  array0.observe(e => {
    event = e
  })
  array0.insert(0, ['stuff'])
  t.assert(event.target === array0, '"target" property is set correctly')
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testEventTargetIsSetCorrectlyOnRemote = tc => {
  const { testConnector, array0, array1, users } = init(tc, { users: 3 })
  /**
   * @type {any}
   */
  let event
  array0.observe(e => {
    event = e
  })
  array1.insert(0, ['stuff'])
  testConnector.flushAllMessages()
  t.assert(event.target === array0, '"target" property is set correctly')
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testMove = tc => {
  {
    // move in uninitialized type
    const yarr = new Y.Array()
    yarr.insert(0, [1, 2, 3])
    yarr.move(1, 0)
    // @ts-ignore
    t.compare(yarr._prelimContent, [2, 1, 3])
  }
  const { array0, array1, users } = init(tc, { users: 3 })
  /**
   * @type {any}
   */
  let event0 = null
  /**
   * @type {any}
   */
  let event1 = null
  array0.observe(event => {
    event0 = event
  })
  array1.observe(event => {
    event1 = event
  })
  array0.insert(0, [1, 2, 3])
  array0.move(1, 0)
  t.compare(array0.toArray(), [2, 1, 3])
  t.compare(event0.delta, [{ insert: [2] }, { retain: 1 }, { delete: 1 }])
  Y.applyUpdate(users[1], Y.encodeStateAsUpdate(users[0]))
  t.compare(array1.toArray(), [2, 1, 3])
  t.compare(event1.delta, [{ insert: [2, 1, 3] }])
  array0.move(0, 2)
  t.compare(array0.toArray(), [1, 2, 3])
  t.compare(event0.delta, [{ delete: 1 }, { retain: 1 }, { insert: [2] }])
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testMove2 = tc => {
  {
    // move in uninitialized type
    const yarr = new Y.Array()
    yarr.insert(0, [1, 2])
    yarr.move(1, 0)
    // @ts-ignore
    t.compare(yarr._prelimContent, [2, 1])
  }
  const { array0, array1, users } = init(tc, { users: 3 })
  /**
   * @type {any}
   */
  let event0 = null
  /**
   * @type {any}
   */
  let event1 = null
  array0.observe(event => {
    event0 = event
  })
  array1.observe(event => {
    event1 = event
  })
  array0.insert(0, [1, 2])
  array0.move(1, 0)
  t.compare(array0.toArray(), [2, 1])
  t.compare(event0.delta, [{ insert: [2] }, { retain: 1 }, { delete: 1 }])
  Y.applyUpdate(users[1], Y.encodeStateAsUpdate(users[0]))
  t.compare(array1.toArray(), [2, 1])
  t.compare(event1.delta, [{ insert: [2, 1] }])
  array0.move(0, 2)
  t.compare(array0.toArray(), [1, 2])
  t.compare(event0.delta, [{ delete: 1 }, { retain: 1 }, { insert: [2] }])
  compare(users)
}

/**
 * @param {t.TestCase} tc
 */
export const testIteratingArrayContainingTypes = tc => {
  const y = new Y.Doc()
  const arr = y.getArray('arr')
  const numItems = 10
  for (let i = 0; i < numItems; i++) {
    const map = new Y.Map()
    map.set('value', i)
    arr.push([map])
  }
  let cnt = 0
  for (const item of arr) {
    t.assert(item.get('value') === cnt++, 'value is correct')
  }
  y.destroy()
}

let _uniqueNumber = 0
const getUniqueNumber = () => _uniqueNumber++

/**
 * @type {Array<function(Doc,prng.PRNG,any):void>}
 *
 * @todo to replace content to a separate data structure so we know that insert & returns work as expected!!!
 */
const arrayTransactions = [
  function move (user, gen) {
    const yarray = user.getArray('array')
    if (yarray.length === 0) {
      return
    }
    const pos = prng.int32(gen, 0, yarray.length - 1)
    const newPos = prng.int32(gen, 0, yarray.length)
    const oldContent = yarray.toArray()
    yarray.move(pos, newPos)
    const [x] = oldContent.splice(pos, 1)
    oldContent.splice(pos < newPos ? newPos - 1 : newPos, 0, x)
    t.compareArrays(yarray.toArray(), oldContent) // we want to make sure that fastSearch markers insert at the correct position
  },
  function insert (user, gen) {
    const yarray = user.getArray('array')
    const uniqueNumber = getUniqueNumber()
    const content = []
    const len = prng.int32(gen, 1, 4)
    for (let i = 0; i < len; i++) {
      content.push(uniqueNumber)
    }
    const pos = prng.int32(gen, 0, yarray.length)
    const oldContent = yarray.toArray()
    yarray.insert(pos, content)
    oldContent.splice(pos, 0, ...content)
    t.compareArrays(yarray.toArray(), oldContent) // we want to make sure that fastSearch markers insert at the correct position
  },
  function insertTypeArray (user, gen) {
    const yarray = user.getArray('array')
    const pos = prng.int32(gen, 0, yarray.length)
    yarray.insert(pos, [new Y.Array()])
    const array2 = yarray.get(pos)
    array2.insert(0, [1, 2, 3, 4])
  },
  function insertTypeMap (user, gen) {
    const yarray = user.getArray('array')
    const pos = prng.int32(gen, 0, yarray.length)
    yarray.insert(pos, [new Y.Map()])
    const map = yarray.get(pos)
    map.set('someprop', 42)
    map.set('someprop', 43)
    map.set('someprop', 44)
  },
  function insertTypeNull (user, gen) {
    const yarray = user.getArray('array')
    const pos = prng.int32(gen, 0, yarray.length)
    yarray.insert(pos, [null])
  },
  function _delete (user, gen) {
    const yarray = user.getArray('array')
    const length = yarray.length
    if (length > 0) {
      let somePos = prng.int32(gen, 0, length - 1)
      let delLength = prng.int32(gen, 1, math.min(2, length - somePos))
      if (prng.bool(gen)) {
        const type = yarray.get(somePos)
        if (type instanceof Y.Array && type.length > 0) {
          somePos = prng.int32(gen, 0, type.length - 1)
          delLength = prng.int32(gen, 0, math.min(2, type.length - somePos))
          type.delete(somePos, delLength)
        }
      } else {
        const oldContent = yarray.toArray()
        yarray.delete(somePos, delLength)
        oldContent.splice(somePos, delLength)
        t.compareArrays(yarray.toArray(), oldContent)
      }
    }
  }
]

/**
 * @param {Y.Doc} user
 */
const monitorArrayTestObject = user => {
  /**
   * @type {Array<any>}
   */
  const arr = []
  const yarr = user.getArray('array')
  yarr.observe(event => {
    let currpos = 0
    const delta = event.delta
    for (let i = 0; i < delta.length; i++) {
      const d = delta[i]
      if (d.insert != null) {
        arr.splice(currpos, 0, ...(/** @type {Array<any>} */ (d.insert)))
        currpos += /** @type {Array<any>} */ (d.insert).length
      } else if (d.retain != null) {
        currpos += d.retain
      } else {
        arr.splice(currpos, d.delete)
      }
    }
  })
  return arr
}

/**
 * @param {{ testObjects: Array<Array<any>>, users: Array<Y.Doc> }} cmp
 */
const compareTestobjects = cmp => {
  const arrs = cmp.testObjects
  for (let i = 0; i < arrs.length; i++) {
    const type = cmp.users[i].getArray('array')
    t.compareArrays(arrs[i], type.toArray())
  }
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests6 = tc => {
  compareTestobjects(applyRandomTests(tc, arrayTransactions, 7, monitorArrayTestObject))
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests40 = tc => {
  applyRandomTests(tc, arrayTransactions, 40)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests42 = tc => {
  applyRandomTests(tc, arrayTransactions, 42)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests43 = tc => {
  applyRandomTests(tc, arrayTransactions, 43)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests44 = tc => {
  applyRandomTests(tc, arrayTransactions, 44)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests45 = tc => {
  applyRandomTests(tc, arrayTransactions, 45)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests46 = tc => {
  applyRandomTests(tc, arrayTransactions, 46)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests300 = tc => {
  applyRandomTests(tc, arrayTransactions, 300)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests400 = tc => {
  applyRandomTests(tc, arrayTransactions, 400)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests500 = tc => {
  applyRandomTests(tc, arrayTransactions, 500)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests600 = tc => {
  applyRandomTests(tc, arrayTransactions, 600)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests1000 = tc => {
  applyRandomTests(tc, arrayTransactions, 1000)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests1800 = tc => {
  applyRandomTests(tc, arrayTransactions, 1800)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests3000 = tc => {
  t.skip(!t.production)
  applyRandomTests(tc, arrayTransactions, 3000)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests5000 = tc => {
  t.skip(!t.production)
  applyRandomTests(tc, arrayTransactions, 5000)
}

/**
 * @param {t.TestCase} tc
 */
export const testRepeatGeneratingYarrayTests30000 = tc => {
  t.skip(!t.production)
  applyRandomTests(tc, arrayTransactions, 30000)
}
