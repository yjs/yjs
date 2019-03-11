import { init, compare, applyRandomTests } from './testHelper.js'
import * as Y from '../src/index.js'
import * as t from 'lib0/testing.js'
import * as prng from 'lib0/prng.js'

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

export const testInsertThreeElementsTryRegetProperty = tc => {
  const { testConnector, users, array0, array1 } = init(tc, { users: 2 })
  array0.insert(0, [1, 2, 3])
  t.compare(array0.toJSON(), [1, 2, 3], '.toJSON() works')
  testConnector.flushAllMessages()
  t.compare(array1.toJSON(), [1, 2, 3], '.toJSON() works after sync')
  compare(users)
}

export const testConcurrentInsertWithThreeConflicts = tc => {
  var { users, array0, array1, array2 } = init(tc, { users: 3 })
  array0.insert(0, [0])
  array1.insert(0, [1])
  array2.insert(0, [2])
  compare(users)
}

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

export const testDisconnectReallyPreventsSendingMessages = tc => {
  var { testConnector, users, array0, array1 } = init(tc, { users: 3 })
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

export const testInsertThenMergeDeleteOnSync = tc => {
  const { testConnector, users, array0, array1 } = init(tc, { users: 2 })
  array0.insert(0, ['x', 'y', 'z'])
  testConnector.flushAllMessages()
  users[0].disconnect()
  array1.delete(0, 3)
  users[0].connect()
  compare(users)
}

const compareEvent = (is, should) => {
  for (var key in should) {
    t.assert(
      should[key] === is[key] ||
      JSON.stringify(should[key]) === JSON.stringify(is[key])
      , 'event works as expected'
    )
  }
}

export const testInsertAndDeleteEvents = tc => {
  const { array0, users } = init(tc, { users: 2 })
  let event
  array0.observe(e => {
    event = e
  })
  array0.insert(0, [0, 1, 2])
  compareEvent(event, {
    remote: false
  })
  array0.delete(0)
  compareEvent(event, {
    remote: false
  })
  array0.delete(0, 2)
  compareEvent(event, {
    remote: false
  })
  compare(users)
}

export const testInsertAndDeleteEventsForTypes = tc => {
  const { array0, users } = init(tc, { users: 2 })
  let event
  array0.observe(e => {
    event = e
  })
  array0.insert(0, [Y.Array])
  compareEvent(event, {
    remote: false
  })
  array0.delete(0)
  compareEvent(event, {
    remote: false
  })
  compare(users)
}

export const testInsertAndDeleteEventsForTypes2 = tc => {
  const { array0, users } = init(tc, { users: 2 })
  let events = []
  array0.observe(e => {
    events.push(e)
  })
  array0.insert(0, ['hi', Y.Map])
  compareEvent(events[0], {
    remote: false
  })
  t.assert(events.length === 1, 'Event is triggered exactly once for insertion of two elements')
  array0.delete(1)
  compareEvent(events[1], {
    remote: false
  })
  t.assert(events.length === 2, 'Event is triggered exactly once for deletion')
  compare(users)
}

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
  compareEvent(event, {
    remote: true
  })
  t.assert(event.target === array0, '"target" property is set correctly')
  compare(users)
}

export const testIteratingArrayContainingTypes = tc => {
  const y = new Y.Y()
  const arr = y.define('arr', Y.Array)
  const numItems = 10
  for (let i = 0; i < numItems; i++) {
    const map = new Y.Map()
    map.set('value', i)
    arr.push([map])
  }
  let cnt = 0
  for (let item of arr) {
    t.assert(item.get('value') === cnt++, 'value is correct')
  }
  y.destroy()
}

let _uniqueNumber = 0
const getUniqueNumber = () => _uniqueNumber++

const arrayTransactions = [
  function insert (tc, user, gen) {
    const yarray = user.define('array', Y.Array)
    var uniqueNumber = getUniqueNumber()
    var content = []
    var len = prng.int31(gen, 1, 4)
    for (var i = 0; i < len; i++) {
      content.push(uniqueNumber)
    }
    var pos = prng.int31(gen, 0, yarray.length)
    yarray.insert(pos, content)
  },
  function insertTypeArray (tc, user, gen) {
    const yarray = user.define('array', Y.Array)
    var pos = prng.int31(gen, 0, yarray.length)
    yarray.insert(pos, [Y.Array])
    var array2 = yarray.get(pos)
    array2.insert(0, [1, 2, 3, 4])
  },
  function insertTypeMap (tc, user, gen) {
    const yarray = user.define('array', Y.Array)
    var pos = prng.int31(gen, 0, yarray.length)
    yarray.insert(pos, [Y.Map])
    var map = yarray.get(pos)
    map.set('someprop', 42)
    map.set('someprop', 43)
    map.set('someprop', 44)
  },
  function _delete (tc, user, gen) {
    const yarray = user.define('array', Y.Array)
    var length = yarray.length
    if (length > 0) {
      var somePos = prng.int31(gen, 0, length - 1)
      var delLength = prng.int31(gen, 1, Math.min(2, length - somePos))
      if (yarray instanceof Y.Array) {
        if (prng.bool(gen)) {
          var type = yarray.get(somePos)
          if (type.length > 0) {
            somePos = prng.int31(gen, 0, type.length - 1)
            delLength = prng.int31(gen, 0, Math.min(2, type.length - somePos))
            type.delete(somePos, delLength)
          }
        } else {
          yarray.delete(somePos, delLength)
        }
      } else {
        yarray.delete(somePos, delLength)
      }
    }
  }
]

export const testRepeatGeneratingYarrayTests20 = tc => {
  applyRandomTests(tc, arrayTransactions, 20)
}

export const testRepeatGeneratingYarrayTests40 = tc => {
  applyRandomTests(tc, arrayTransactions, 40)
}

export const testRepeatGeneratingYarrayTests42 = tc => {
  applyRandomTests(tc, arrayTransactions, 42)
}

export const testRepeatGeneratingYarrayTests43 = tc => {
  applyRandomTests(tc, arrayTransactions, 43)
}

export const testRepeatGeneratingYarrayTests44 = tc => {
  applyRandomTests(tc, arrayTransactions, 44)
}

export const testRepeatGeneratingYarrayTests45 = tc => {
  applyRandomTests(tc, arrayTransactions, 45)
}

export const testRepeatGeneratingYarrayTests46 = tc => {
  applyRandomTests(tc, arrayTransactions, 46)
}

export const testRepeatGeneratingYarrayTests300 = tc => {
  applyRandomTests(tc, arrayTransactions, 300)
}

/* TODO: implement something like difficutly in lib0

export const testRepeatGeneratingYarrayTests400 = tc => {
  applyRandomTests(tc, arrayTransactions, 400)
}

export const testRepeatGeneratingYarrayTests500 = tc => {
  applyRandomTests(tc, arrayTransactions, 500)
}

export const testRepeatGeneratingYarrayTests600 = tc => {
  applyRandomTests(tc, arrayTransactions, 600)
}

export const testRepeatGeneratingYarrayTests1000 = tc => {
  applyRandomTests(tc, arrayTransactions, 1000)
}

export const testRepeatGeneratingYarrayTests1800 = tc => {
  applyRandomTests(tc, arrayTransactions, 1800)
}

export const testRepeatGeneratingYarrayTests10000 = tc => {
  applyRandomTests(tc, arrayTransactions, 10000)
}
*/
