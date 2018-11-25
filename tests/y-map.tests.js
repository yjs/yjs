import { initArrays, compareUsers, applyRandomTests } from './helper.js'
import * as Y from '../index.js'
import { test, proxyConsole } from 'cutest'
import * as random from '../lib/prng/prng.js'

proxyConsole()

test('basic map tests', async function map0 (t) {
  let { testConnector, users, map0, map1, map2 } = await initArrays(t, { users: 3 })
  users[2].disconnect()

  map0.set('number', 1)
  map0.set('string', 'hello Y')
  map0.set('object', { key: { key2: 'value' } })
  map0.set('y-map', new Y.Map())
  let map = map0.get('y-map')
  map.set('y-array', new Y.Array())
  let array = map.get('y-array')
  array.insert(0, [0])
  array.insert(0, [-1])

  t.assert(map0.get('number') === 1, 'client 0 computed the change (number)')
  t.assert(map0.get('string') === 'hello Y', 'client 0 computed the change (string)')
  t.compare(map0.get('object'), { key: { key2: 'value' } }, 'client 0 computed the change (object)')
  t.assert(map0.get('y-map').get('y-array').get(0) === -1, 'client 0 computed the change (type)')

  await users[2].connect()
  testConnector.flushAllMessages()

  t.assert(map1.get('number') === 1, 'client 1 received the update (number)')
  t.assert(map1.get('string') === 'hello Y', 'client 1 received the update (string)')
  t.compare(map1.get('object'), { key: { key2: 'value' } }, 'client 1 received the update (object)')
  t.assert(map1.get('y-map').get('y-array').get(0) === -1, 'client 1 received the update (type)')

  // compare disconnected user
  t.assert(map2.get('number') === 1, 'client 2 received the update (number) - was disconnected')
  t.assert(map2.get('string') === 'hello Y', 'client 2 received the update (string) - was disconnected')
  t.compare(map2.get('object'), { key: { key2: 'value' } }, 'client 2 received the update (object) - was disconnected')
  t.assert(map2.get('y-map').get('y-array').get(0) === -1, 'client 2 received the update (type) - was disconnected')
  await compareUsers(t, users)
})

test('Basic get&set of Map property (converge via sync)', async function map1 (t) {
  let { testConnector, users, map0 } = await initArrays(t, { users: 2 })
  map0.set('stuff', 'stuffy')
  map0.set('undefined', undefined)
  map0.set('null', null)
  t.compare(map0.get('stuff'), 'stuffy')

  testConnector.flushAllMessages()

  for (let user of users) {
    var u = user.define('map', Y.Map)
    t.compare(u.get('stuff'), 'stuffy')
    t.assert(u.get('undefined') === undefined, 'undefined')
    t.compare(u.get('null'), null, 'null')
  }
  await compareUsers(t, users)
})

test('Map can set custom types (Map)', async function map2 (t) {
  let { users, map0 } = await initArrays(t, { users: 2 })
  var map = map0.set('Map', new Y.Map())
  map.set('one', 1)
  map = map0.get('Map')
  t.compare(map.get('one'), 1)
  await compareUsers(t, users)
})

test('Map can set custom types (Map) - get also returns the type', async function map3 (t) {
  let { users, map0 } = await initArrays(t, { users: 2 })
  map0.set('Map', new Y.Map())
  var map = map0.get('Map')
  map.set('one', 1)
  map = map0.get('Map')
  t.compare(map.get('one'), 1)
  await compareUsers(t, users)
})

test('Map can set custom types (Array)', async function map4 (t) {
  let { users, map0 } = await initArrays(t, { users: 2 })
  var array = map0.set('Array', new Y.Array())
  array.insert(0, [1, 2, 3])
  array = map0.get('Array')
  t.compare(array.toArray(), [1, 2, 3])
  await compareUsers(t, users)
})

test('Basic get&set of Map property (converge via update)', async function map5 (t) {
  let { testConnector, users, map0 } = await initArrays(t, { users: 2 })
  map0.set('stuff', 'stuffy')
  t.compare(map0.get('stuff'), 'stuffy')

  testConnector.flushAllMessages()

  for (let user of users) {
    var u = user.define('map', Y.Map)
    t.compare(u.get('stuff'), 'stuffy')
  }
  await compareUsers(t, users)
})

test('Basic get&set of Map property (handle conflict)', async function map6 (t) {
  let { testConnector, users, map0, map1 } = await initArrays(t, { users: 3 })
  map0.set('stuff', 'c0')
  map1.set('stuff', 'c1')

  testConnector.flushAllMessages()

  for (let user of users) {
    var u = user.define('map', Y.Map)
    t.compare(u.get('stuff'), 'c0')
  }
  await compareUsers(t, users)
})

test('Basic get&set&delete of Map property (handle conflict)', async function map7 (t) {
  let { testConnector, users, map0, map1 } = await initArrays(t, { users: 3 })
  map0.set('stuff', 'c0')
  map0.delete('stuff')
  map1.set('stuff', 'c1')
  testConnector.flushAllMessages()
  for (let user of users) {
    var u = user.define('map', Y.Map)
    t.assert(u.get('stuff') === undefined)
  }
  await compareUsers(t, users)
})

test('Basic get&set of Map property (handle three conflicts)', async function map8 (t) {
  let { testConnector, users, map0, map1, map2 } = await initArrays(t, { users: 3 })
  map0.set('stuff', 'c0')
  map1.set('stuff', 'c1')
  map1.set('stuff', 'c2')
  map2.set('stuff', 'c3')
  testConnector.flushAllMessages()
  for (let user of users) {
    var u = user.define('map', Y.Map)
    t.compare(u.get('stuff'), 'c0')
  }
  await compareUsers(t, users)
})

test('Basic get&set&delete of Map property (handle three conflicts)', async function map9 (t) {
  let { testConnector, users, map0, map1, map2, map3 } = await initArrays(t, { users: 4 })
  map0.set('stuff', 'c0')
  map1.set('stuff', 'c1')
  map1.set('stuff', 'c2')
  map2.set('stuff', 'c3')
  testConnector.flushAllMessages()
  map0.set('stuff', 'deleteme')
  map0.delete('stuff')
  map1.set('stuff', 'c1')
  map2.set('stuff', 'c2')
  map3.set('stuff', 'c3')
  testConnector.flushAllMessages()
  for (let user of users) {
    var u = user.define('map', Y.Map)
    t.assert(u.get('stuff') === undefined)
  }
  await compareUsers(t, users)
})

/* TODO reimplement observePath
test('observePath properties', async function map10 (t) {
  let { users, map0, map1, map2 } = await initArrays(t, { users: 3 })
  let map
  map0.observePath(['map'], map => {
    if (map != null) {
      map.set('yay', 4)
    }
  })
  map1.set('map', new Y.Map())
  testConnector.flushAllMessages()
  map = map2.get('map')
  t.compare(map.get('yay'), 4)
  await compareUsers(t, users)
})
*/

test('observe deep properties', async function map11 (t) {
  let { testConnector, users, map1, map2, map3 } = await initArrays(t, { users: 4 })
  var _map1 = map1.set('map', new Y.Map())
  var calls = 0
  var dmapid
  map1.observeDeep(events => {
    events.forEach(event => {
      calls++
      t.assert(event.keysChanged.has('deepmap'))
      t.assert(event.path.length === 1)
      t.assert(event.path[0] === 'map')
      dmapid = event.target.get('deepmap')._id
    })
  })
  testConnector.flushAllMessages()
  var _map3 = map3.get('map')
  _map3.set('deepmap', new Y.Map())
  testConnector.flushAllMessages()
  var _map2 = map2.get('map')
  _map2.set('deepmap', new Y.Map())
  testConnector.flushAllMessages()
  var dmap1 = _map1.get('deepmap')
  var dmap2 = _map2.get('deepmap')
  var dmap3 = _map3.get('deepmap')
  t.assert(calls > 0)
  t.assert(dmap1._id.equals(dmap2._id))
  t.assert(dmap1._id.equals(dmap3._id))
  t.assert(dmap1._id.equals(dmapid))
  await compareUsers(t, users)
})

test('observes using observeDeep', async function map12 (t) {
  let { users, map0 } = await initArrays(t, { users: 2 })
  var pathes = []
  var calls = 0
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
  await compareUsers(t, users)
})

/* TODO: Test events in Y.Map
function compareEvent (t, is, should) {
  for (var key in should) {
    t.assert(should[key] === is[key])
  }
}

test('throws add & update & delete events (with type and primitive content)', async function map13 (t) {
  let { users, map0 } = await initArrays(t, { users: 2 })
  var event
  await flushAll(t, users)
  map0.observe(e => {
    event = e // just put it on event, should be thrown synchronously anyway
  })
  map0.set('stuff', 4)
  compareEvent(t, event, {
    type: 'add',
    object: map0,
    name: 'stuff'
  })
  // update, oldValue is in contents
  map0.set('stuff', new Y.Array())
  compareEvent(t, event, {
    type: 'update',
    object: map0,
    name: 'stuff',
    oldValue: 4
  })
  var replacedArray = map0.get('stuff')
  // update, oldValue is in opContents
  map0.set('stuff', 5)
  var array = event.oldValue
  t.compare(array._model, replacedArray._model)
  // delete
  map0.delete('stuff')
  compareEvent(t, event, {
    type: 'delete',
    name: 'stuff',
    object: map0,
    oldValue: 5
  })
  await compareUsers(t, users)
})
*/

/* reimplement event.value somehow (probably with ss vector)
test('event has correct value when setting a primitive on a YMap (same user)', async function map14 (t) {
  let { users, map0 } = await initArrays(t, { users: 3 })
  var event
  await flushAll(t, users)
  map0.observe(e => {
    event = e
  })
  map0.set('stuff', 2)
  t.compare(event.value, event.target.get(event.name))
  await compareUsers(t, users)
})

test('event has correct value when setting a primitive on a YMap (received from another user)', async function map15 (t) {
  let { users, map0, map1 } = await initArrays(t, { users: 3 })
  var event
  await flushAll(t, users)
  map0.observe(e => {
    event = e
  })
  map1.set('stuff', 2)
  await flushAll(t, users)
  t.compare(event.value, event.target.get(event.name))
  await compareUsers(t, users)
})
*/

var mapTransactions = [
  function set (t, user, prng) {
    let key = random.oneOf(prng, ['one', 'two'])
    var value = random.utf16String(prng)
    user.define('map', Y.Map).set(key, value)
  },
  function setType (t, user, prng) {
    let key = random.oneOf(prng, ['one', 'two'])
    var type = random.oneOf(prng, [new Y.Array(), new Y.Map()])
    user.define('map', Y.Map).set(key, type)
    if (type instanceof Y.Array) {
      type.insert(0, [1, 2, 3, 4])
    } else {
      type.set('deepkey', 'deepvalue')
    }
  },
  function _delete (t, user, prng) {
    let key = random.oneOf(prng, ['one', 'two'])
    user.define('map', Y.Map).delete(key)
  }
]

test('y-map: Random tests (42)', async function randomMap42 (t) {
  await applyRandomTests(t, mapTransactions, 42)
})

test('y-map: Random tests (43)', async function randomMap43 (t) {
  await applyRandomTests(t, mapTransactions, 43)
})

test('y-map: Random tests (44)', async function randomMap44 (t) {
  await applyRandomTests(t, mapTransactions, 44)
})

test('y-map: Random tests (45)', async function randomMap45 (t) {
  await applyRandomTests(t, mapTransactions, 45)
})

test('y-map: Random tests (46)', async function randomMap46 (t) {
  await applyRandomTests(t, mapTransactions, 46)
})

test('y-map: Random tests (47)', async function randomMap47 (t) {
  await applyRandomTests(t, mapTransactions, 47)
})

test('y-map: Random tests (200)', async function randomMap200 (t) {
  await applyRandomTests(t, mapTransactions, 200)
})

test('y-map: Random tests (300)', async function randomMap300 (t) {
  await applyRandomTests(t, mapTransactions, 300)
})

test('y-map: Random tests (500)', async function randomMap500 (t) {
  await applyRandomTests(t, mapTransactions, 500)
})

test('y-map: Random tests (1000)', async function randomMap1000 (t) {
  await applyRandomTests(t, mapTransactions, 1000)
})

test('y-map: Random tests (1800)', async function randomMap1800 (t) {
  await applyRandomTests(t, mapTransactions, 1800)
})
