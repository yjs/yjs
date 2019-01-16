import { initArrays, compareUsers, applyRandomTests } from './helper.js'
import * as Y from '../index.js'
import { test, proxyConsole } from 'cutest'
import * as random from '../lib/prng/prng.js'

proxyConsole()
test('basic spec', async function array0 (t) {
  let { users, array0 } = await initArrays(t, { users: 2 })

  array0.delete(0, 0)
  t.assert(true, 'Does not throw when deleting zero elements with position 0')

  let throwInvalidPosition = false
  try {
    array0.delete(1, 1)
  } catch (e) {
    throwInvalidPosition = true
  }
  t.assert(throwInvalidPosition, 'Throws when deleting with an invalid position')

  array0.insert(0, ['A'])
  array0.delete(1, 0)
  t.assert(true, 'Does not throw when deleting zero elements with valid position 1')

  await compareUsers(t, users)
})

test('insert three elements, try re-get property', async function array1 (t) {
  var { testConnector, users, array0, array1 } = initArrays(t, { users: 2 })
  array0.insert(0, [1, 2, 3])
  t.compare(array0.toJSON(), [1, 2, 3], '.toJSON() works')
  testConnector.flushAllMessages()
  t.compare(array1.toJSON(), [1, 2, 3], '.toJSON() works after sync')
  await compareUsers(t, users)
})

test('concurrent insert (handle three conflicts)', async function array2 (t) {
  var { users, array0, array1, array2 } = await initArrays(t, { users: 3 })
  array0.insert(0, [0])
  array1.insert(0, [1])
  array2.insert(0, [2])
  await compareUsers(t, users)
})

test('concurrent insert&delete (handle three conflicts)', async function array3 (t) {
  var { testConnector, users, array0, array1, array2 } = await initArrays(t, { users: 3 })
  array0.insert(0, ['x', 'y', 'z'])
  testConnector.flushAllMessages()
  array0.insert(1, [0])
  array1.delete(0)
  array1.delete(1, 1)
  array2.insert(1, [2])

  await compareUsers(t, users)
})

test('insertions work in late sync', async function array4 (t) {
  var { testConnector, users, array0, array1, array2 } = await initArrays(t, { users: 3 })
  array0.insert(0, ['x', 'y'])
  testConnector.flushAllMessages()
  users[1].disconnect()
  users[2].disconnect()
  array0.insert(1, ['user0'])
  array1.insert(1, ['user1'])
  array2.insert(1, ['user2'])
  await users[1].connect()
  await users[2].connect()
  testConnector.flushAllMessages()
  await compareUsers(t, users)
})

test('disconnect really prevents sending messages', async function array5 (t) {
  var { testConnector, users, array0, array1 } = await initArrays(t, { users: 3 })
  array0.insert(0, ['x', 'y'])
  testConnector.flushAllMessages()
  users[1].disconnect()
  users[2].disconnect()
  array0.insert(1, ['user0'])
  array1.insert(1, ['user1'])
  t.compare(array0.toJSON(), ['x', 'user0', 'y'])
  t.compare(array1.toJSON(), ['x', 'user1', 'y'])
  await users[1].connect()
  await users[2].connect()
  await compareUsers(t, users)
})

test('deletions in late sync', async function array6 (t) {
  var { testConnector, users, array0, array1 } = await initArrays(t, { users: 2 })
  array0.insert(0, ['x', 'y'])
  testConnector.flushAllMessages()
  await users[1].disconnect()
  array1.delete(1, 1)
  array0.delete(0, 2)
  await users[1].connect()
  await compareUsers(t, users)
})

test('insert, then marge delete on sync', async function array7 (t) {
  var { testConnector, users, array0, array1 } = await initArrays(t, { users: 2 })
  array0.insert(0, ['x', 'y', 'z'])
  testConnector.flushAllMessages()
  users[0].disconnect()
  array1.delete(0, 3)
  users[0].connect()
  await compareUsers(t, users)
})

function compareEvent (t, is, should) {
  for (var key in should) {
    t.assert(
      should[key] === is[key] ||
      JSON.stringify(should[key]) === JSON.stringify(is[key])
      , 'event works as expected'
    )
  }
}

test('insert & delete events', async function array8 (t) {
  var { array0, users } = await initArrays(t, { users: 2 })
  var event
  array0.observe(e => {
    event = e
  })
  array0.insert(0, [0, 1, 2])
  compareEvent(t, event, {
    remote: false
  })
  array0.delete(0)
  compareEvent(t, event, {
    remote: false
  })
  array0.delete(0, 2)
  compareEvent(t, event, {
    remote: false
  })
  await compareUsers(t, users)
})

test('insert & delete events for types', async function array9 (t) {
  var { array0, users } = await initArrays(t, { users: 2 })
  var event
  array0.observe(e => {
    event = e
  })
  array0.insert(0, [Y.Array])
  compareEvent(t, event, {
    remote: false
  })
  array0.delete(0)
  compareEvent(t, event, {
    remote: false
  })
  await compareUsers(t, users)
})

test('insert & delete events for types (2)', async function array10 (t) {
  var { array0, users } = await initArrays(t, { users: 2 })
  var events = []
  array0.observe(e => {
    events.push(e)
  })
  array0.insert(0, ['hi', Y.Map])
  compareEvent(t, events[0], {
    remote: false
  })
  t.assert(events.length === 1, 'Event is triggered exactly once for insertion of two elements')
  array0.delete(1)
  compareEvent(t, events[1], {
    remote: false
  })
  t.assert(events.length === 2, 'Event is triggered exactly once for deletion')
  await compareUsers(t, users)
})

test('garbage collector', async function gc1 (t) {
  var { testConnector, users, array0 } = await initArrays(t, { users: 3 })
  array0.insert(0, ['x', 'y', 'z'])
  testConnector.flushAllMessages()
  users[0].disconnect()
  array0.delete(0, 3)
  await users[0].connect()
  testConnector.flushAllMessages()
  await compareUsers(t, users)
})

test('event target is set correctly (local)', async function array11 (t) {
  let { array0, users } = await initArrays(t, { users: 3 })
  var event
  array0.observe(e => {
    event = e
  })
  array0.insert(0, ['stuff'])
  t.assert(event.target === array0, '"target" property is set correctly')
  await compareUsers(t, users)
})

test('event target is set correctly (remote user)', async function array12 (t) {
  let { testConnector, array0, array1, users } = await initArrays(t, { users: 3 })
  var event
  array0.observe(e => {
    event = e
  })
  array1.insert(0, ['stuff'])
  testConnector.flushAllMessages()
  compareEvent(t, event, {
    remote: true
  })
  t.assert(event.target === array0, '"target" property is set correctly')
  await compareUsers(t, users)
})

test('should correctly iterate an array containing types', async function iterate1 (t) {
  const y = new Y.Y()
  const arr = y.define('arr', Y.Array)
  const numItems = 10
  for(let i = 0; i < numItems; i++) {
    const map = new Y.Map()
    map.set('value', i)
    arr.push([map])
  }
  let cnt = 0
  for(let item of arr) {
    t.assert(item.get('value') === cnt++, 'value is correct')
  }
  y.destroy()
})

var _uniqueNumber = 0
function getUniqueNumber () {
  return _uniqueNumber++
}

var arrayTransactions = [
  function insert (t, user, prng) {
    const yarray = user.define('array', Y.Array)
    var uniqueNumber = getUniqueNumber()
    var content = []
    var len = random.int32(prng, 1, 4)
    for (var i = 0; i < len; i++) {
      content.push(uniqueNumber)
    }
    var pos = random.int32(prng, 0, yarray.length)
    yarray.insert(pos, content)
  },
  function insertTypeArray (t, user, prng) {
    const yarray = user.define('array', Y.Array)
    var pos = random.int32(prng, 0, yarray.length)
    yarray.insert(pos, [Y.Array])
    var array2 = yarray.get(pos)
    array2.insert(0, [1, 2, 3, 4])
  },
  function insertTypeMap (t, user, prng) {
    const yarray = user.define('array', Y.Array)
    var pos = random.int32(prng, 0, yarray.length)
    yarray.insert(pos, [Y.Map])
    var map = yarray.get(pos)
    map.set('someprop', 42)
    map.set('someprop', 43)
    map.set('someprop', 44)
  },
  function _delete (t, user, prng) {
    const yarray = user.define('array', Y.Array)
    var length = yarray.length
    if (length > 0) {
      var somePos = random.int32(prng, 0, length - 1)
      var delLength = random.int32(prng, 1, Math.min(2, length - somePos))
      if (yarray instanceof Y.Array) {
        if (random.bool(prng)) {
          var type = yarray.get(somePos)
          if (type.length > 0) {
            somePos = random.int32(prng, 0, type.length - 1)
            delLength = random.int32(prng, 0, Math.min(2, type.length - somePos))
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

test('y-array: Random tests (20)', async function randomArray20 (t) {
  await applyRandomTests(t, arrayTransactions, 20)
})

test('y-array: Random tests (42)', async function randomArray42 (t) {
  await applyRandomTests(t, arrayTransactions, 42)
})

test('y-array: Random tests (43)', async function randomArray43 (t) {
  await applyRandomTests(t, arrayTransactions, 43)
})

test('y-array: Random tests (44)', async function randomArray44 (t) {
  await applyRandomTests(t, arrayTransactions, 44)
})

test('y-array: Random tests (45)', async function randomArray45 (t) {
  await applyRandomTests(t, arrayTransactions, 45)
})

test('y-array: Random tests (46)', async function randomArray46 (t) {
  await applyRandomTests(t, arrayTransactions, 46)
})

test('y-array: Random tests (47)', async function randomArray47 (t) {
  await applyRandomTests(t, arrayTransactions, 47)
})

test('y-array: Random tests (300)', async function randomArray300 (t) {
  await applyRandomTests(t, arrayTransactions, 200)
})

test('y-array: Random tests (500)', async function randomArray500 (t) {
  await applyRandomTests(t, arrayTransactions, 300)
})

test('y-array: Random tests (600)', async function randomArray600 (t) {
  await applyRandomTests(t, arrayTransactions, 400)
})

test('y-array: Random tests (700)', async function randomArray700 (t) {
  await applyRandomTests(t, arrayTransactions, 500)
})

test('y-array: Random tests (1000)', async function randomArray1000 (t) {
  await applyRandomTests(t, arrayTransactions, 1000)
})

test('y-array: Random tests (1800)', async function randomArray1800 (t) {
  await applyRandomTests(t, arrayTransactions, 2000)
})
