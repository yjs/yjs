/**
 * Testing if encoding/decoding compatibility and integration compatibility is given.
 * We expect that the document always looks the same, even if we upgrade the integration algorithm, or add additional encoding approaches.
 *
 * The v1 documents were generated with Yjs v13.2.0 based on the randomisized tests.
 */

import * as Y from '../src/index.js'
import * as t from 'lib0/testing'
import * as delta from 'lib0/delta'
import * as prng from 'lib0/prng'
import * as math from 'lib0/math'
import { bind, $rdt } from 'lib0/delta/rdt'
import { writeStructsFromIdSet } from '../src/utils/encoding-helpers.js'
import { init } from './testHelper.js' // eslint-disable-line

/**
 * @param {t.TestCase} _tc
 */
export const testRelativePositions = _tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get()
  ytext.insert(0, 'hello world')
  const v1 = Y.cloneDoc(ydoc)
  ytext.delete(1, 6)
  ytext.insert(1, 'x')
  const renderer = Y.createDiffRenderer(v1, ydoc)
  const rel = Y.createRelativePositionFromTypeIndex(ytext, 9, 1, renderer) // pos after "hello wo"
  const abs1 = Y.createAbsolutePositionFromRelativePosition(rel, ydoc, true, renderer)
  const abs2 = Y.createAbsolutePositionFromRelativePosition(rel, ydoc, true)
  t.assert(abs1?.index === 9)
  t.assert(abs2?.index === 3)
}

/**
 * @param {t.TestCase} _tc
 */
export const testAttributedEvents = _tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get()
  ytext.insert(0, 'hello world')
  const v1 = Y.cloneDoc(ydoc)
  ydoc.transact(() => {
    ytext.delete(6, 5)
  })
  const renderer = Y.createDiffRenderer(v1, ydoc)
  const c1 = ytext.toDelta({ renderer })
  t.compare(c1, delta.create().insert('hello ').insert('world', null, { delete: [] }).done())
  let calledObserver = false
  ytext.observe(event => {
    const d = event.getDelta({ renderer })
    t.compare(d, delta.create().retain(11).insert('!', null, { insert: [] }).done())
    calledObserver = true
  })
  ytext.applyDelta(delta.create().retain(11).insert('!').done(), null, { renderer })
  t.assert(calledObserver)
}

/**
 * @param {t.TestCase} _tc
 */
export const testInsertionsMindingAttributedContent = _tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get()
  ytext.insert(0, 'hello world')
  const v1 = Y.cloneDoc(ydoc)
  ydoc.transact(() => {
    ytext.delete(6, 5)
  })
  const renderer = Y.createDiffRenderer(v1, ydoc)
  const c1 = ytext.toDelta({ renderer })
  t.compare(c1, delta.create().insert('hello ').insert('world', null, { delete: [] }).done())
  ytext.applyDelta(delta.create().retain(11).insert('content').done(), null, { renderer })
  t.assert(ytext.toString() === 'hello content')
}

/**
 * @param {t.TestCase} _tc
 */
export const testInsertionsIntoAttributedContent = _tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get()
  ytext.insert(0, 'hello ')
  const v1 = Y.cloneDoc(ydoc)
  ydoc.transact(() => {
    ytext.insert(6, 'word')
  })
  const renderer = Y.createDiffRenderer(v1, ydoc)
  const c1 = ytext.toDelta({ renderer })
  t.compare(c1, delta.create().insert('hello ').insert('word', null, { insert: [] }).done())
  ytext.applyDelta(delta.create().retain(9).insert('l').done(), null, { renderer })
  t.assert(ytext.toString() === 'hello world')
}

export const testYdocDiff = () => {
  const ydocStart = new Y.Doc()
  ydocStart.get('text').insert(0, 'hello')
  ydocStart.get('array').insert(0, [1, 2, 3])
  ydocStart.get('map').setAttr('k', 42)
  ydocStart.get('map').setAttr('nested', new Y.Node())
  const ydocUpdated = Y.cloneDoc(ydocStart)
  ydocUpdated.get('text').insert(5, ' world')
  ydocUpdated.get('array').insert(1, ['x'])
  ydocUpdated.get('map').setAttr('newk', 42)
  ydocUpdated.get('map').getAttr('nested').insert(0, [1])
  // @todo add custom attribution
  const d = Y.diffDocsToDelta(ydocStart, ydocUpdated).done()
  console.log('calculated diff', d.toJSON())
  const expected = delta.create()
    .modifyAttr('text', delta.create().retain(5).insert(' world', null, { insert: [] }))
    .modifyAttr('array', delta.create().retain(1).insert(['x'], null, { insert: [] }))
    .modifyAttr('map', delta.create().setAttr('newk', 42, { insert: [] }).modifyAttr('nested', delta.create().insert([1], null, { insert: [] })))
  const expectedDone = expected.done()
  t.compare(d, expectedDone)
}

export const testChildListContent = () => {
  const ydocStart = new Y.Doc()
  const ydocUpdated = Y.cloneDoc(ydocStart)
  const yf = new Y.Node('test')
  let calledEvent = 0
  yf.applyDelta(delta.create().insert('test content').setAttr('k', 'v').done())

  const yarray = ydocUpdated.get('array')
  yarray.observeDeep(event => {
    calledEvent++
    const d = event.deltaDeep
    const expectedD = delta.create().insert([delta.create('test').insert('test content').setAttr('k', 'v')])
    t.compare(d, expectedD)
  })
  ydocUpdated.get('array').insert(0, [yf])
  t.assert(calledEvent === 1)
  const d = Y.diffDocsToDelta(ydocStart, ydocUpdated)
  console.log('calculated diff', d.toJSON())
  const expected = delta.create()
    .modifyAttr('array', delta.create().insert([delta.create('test').insert('test content', null, { insert: [] }).setAttr('k', 'v', { insert: [] })], null, { insert: [] }).done())
  t.compare(d.done(), expected.done())
}

/**
 * @param {t.TestCase} tc
 */
export const testAttributionSession1 = tc => {
  const { testConnector, users, text0, text1 } = init(tc, { users: 3 })
  users[0].gc = false
  const globalAttributions = Y.createContentMap()
  const v1 = Y.cloneDoc(users[0])
  users.forEach(user => user.on('update', (update, _, ydoc, tr) => {
    if (!tr.local) return
    const userid = ydoc.clientID.toString()
    const contentIds = Y.createContentIdsFromUpdate(update)
    Y.insertIntoIdMap(globalAttributions.inserts, Y.createIdMapFromIdSet(contentIds.inserts, [Y.createContentAttribute('insert', userid)]))
    Y.insertIntoIdMap(globalAttributions.deletes, Y.createIdMapFromIdSet(contentIds.deletes, [Y.createContentAttribute('delete', userid)]))
  }))
  text0.insert(0, 'a')
  text1.insert(0, 'b')
  testConnector.flushAllMessages()
  const d1 = text0.toDelta({ renderer: Y.createDiffRenderer(v1, users[0], { attributions: globalAttributions }) })
  t.compare(d1, delta.create().insert('a', null, { insert: ['0'] }).insert('b', null, { insert: ['1'] }).done())
  const v2 = Y.cloneDoc(users[0])
  text0.delete(1, 1)
  text1.insert(2, 'c')
  testConnector.flushAllMessages()
  const d2 = text0.toDelta({ renderer: Y.createDiffRenderer(v2, users[0], { attributions: globalAttributions }) })
  t.compare(d2, delta.create().insert('a').insert('b', null, { delete: ['0'] }).insert('c', null, { insert: ['1'] }).done())

  const onlyUser0ChangesAttributed = Y.createContentMap(
    Y.filterIdMap(globalAttributions.inserts, attrs => attrs.some(attr => attr.name === 'insert' && attr.val === '0')),
    Y.filterIdMap(globalAttributions.deletes, attrs => attrs.some(attr => attr.name === 'delete' && attr.val === '0'))
  )
  const rendererUser0 = new Y.AttributionsRenderer(onlyUser0ChangesAttributed)
  const d3 = text0.toDelta({ renderer: rendererUser0 })
  t.compare(d3, delta.create().insert('a', null, { insert: ['0'] }).insert('b', null, { delete: ['0'] }).insert('c').done())
  Y.undoContentIds(users[0], Y.createContentIdsFromContentMap(onlyUser0ChangesAttributed))

  const d4 = text0.toDelta()
  t.compare(d4, delta.create().insert('bc').done())
}

export const testAttributionEvent = () => {
  const ydoc = new Y.Doc()
  const ynode = ydoc.get()
  // <p>hi</p>
  ynode.applyDelta(delta.create().insert([delta.create('p').insert('hi').done()]).done())
  const ydocBase = Y.cloneDoc(ydoc)
  const renderer = Y.createDiffRenderer(ydocBase, ydoc)
  let called = false
  ynode.observeDeep(event => {
    const change = event.getDelta({ renderer })
    const expectedChange = delta.create().modify(delta.create('p').retain(2, null, { delete: [] }), null, { delete: [] }).done()
    t.compare(
      change,
      expectedChange
    )
    called = true
  })
  // delete <p>
  // we expect that the children get attributions as well
  ynode.delete(0, 1)
  t.assert(called)
}

export const testAttributionChange = () => {
  const ydoc = new Y.Doc()
  const ynode = ydoc.get()
  ynode.applyDelta(delta.create().insert('hi').done())
  const ydocClone = Y.cloneDoc(ydoc)
  const renderer = Y.createDiffRenderer(ydocClone, ydoc)
  ynode.applyDelta(delta.create().retain(2).insert('!').done())
  let calledHandler = false
  renderer.on('change', changes => {
    calledHandler = true
    const changeUpdate = ynode.toDelta({ renderer, deep: true, itemsToRender: changes, retainInserts: true, retainDeletes: true })
    // the '!' lost its `{ insert: [] }` suggestion attribution → the change clears it (tri-state `null`)
    const expectedUpdate = delta.create().retain(2).retain(1, undefined, null)
    t.compare(changeUpdate, expectedUpdate)
  })
  Y.applyUpdate(ydocClone, Y.encodeStateAsUpdate(ydoc))
  t.assert(calledHandler)
}

/**
 * A YNode implements the lib0 `RDT` interface, so two types can be kept in sync with `bind`.
 */
export const testRdtBinding = () => {
  const docA = new Y.Doc()
  const docB = new Y.Doc()
  const a = docA.get('text')
  const b = docB.get('text')
  const binding = bind(a, b)
  // edit A -> propagates to B
  a.insert(0, 'hello')
  t.assert(b.toString() === 'hello')
  // edit B -> propagates back to A (no echo loop)
  b.insert(5, ' world')
  t.assert(a.toString() === 'hello world')
  t.assert(b.toString() === 'hello world')
  // after the binding is destroyed, changes no longer propagate
  binding.destroy()
  a.insert(0, 'x')
  t.assert(a.toString() === 'xhello world')
  t.assert(b.toString() === 'hello world')
}

/**
 * Local changes are emitted on the `'delta'` channel as the deep delta.
 */
export const testRdtDeltaEvent = () => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get()
  /**
   * @type {any}
   */
  let captured = null
  ytext.on('delta', d => { captured = d })
  ytext.insert(0, 'hello')
  t.compare(captured, delta.create().insert('hello').done())
}

/**
 * The `'delta'` event carries the transaction origin as its second argument.
 */
export const testRdtDeltaEventOrigin = () => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get()
  /**
   * @type {any}
   */
  let capturedOrigin = null
  ytext.on('delta', (_d, origin) => { capturedOrigin = origin })
  const myOrigin = {}
  ydoc.transact(() => {
    ytext.insert(0, 'hello')
  }, myOrigin)
  t.assert(capturedOrigin === myOrigin)
  // without an explicit origin, `null` is emitted
  capturedOrigin = myOrigin
  ytext.insert(5, ' world')
  t.assert(capturedOrigin === null)
  // the origin passed to `applyDelta` becomes the transaction origin and is forwarded on the event
  const applyOrigin = {}
  ytext.applyDelta(delta.create().retain(11).insert('!').done(), applyOrigin)
  t.assert(capturedOrigin === applyOrigin)
  // `applyDelta` without an explicit origin emits `null`
  capturedOrigin = applyOrigin
  ytext.applyDelta(delta.create().retain(12).insert('?').done())
  t.assert(capturedOrigin === null)
}

/**
 * `useRenderer` changes the default renderer used by `toDelta` (and friends). Calling `toDelta()`
 * with no argument afterwards is equivalent to passing the renderer explicitly.
 */
export const testUseRenderer = () => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get()
  ytext.insert(0, 'hello world')
  const v1 = Y.cloneDoc(ydoc)
  ydoc.transact(() => {
    ytext.delete(6, 5)
  })
  const renderer = Y.createDiffRenderer(v1, ydoc)
  const explicit = ytext.toDelta({ renderer })
  // change the default renderer; toDelta() with no arg now matches the explicit form
  ytext.useRenderer(renderer)
  const viaDefault = ytext.toDelta()
  t.compare(viaDefault, explicit)
  t.compare(viaDefault, delta.create().insert('hello ').insert('world', null, { delete: [] }).done())
}

/**
 * `destroy()` emits the RDT `'destroy'` event, and top-level types are destroyed with their Doc.
 */
export const testRdtDestroy = () => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get('text')
  let destroyed = 0
  ytext.on('destroy', () => { destroyed++ })
  ytext.destroy()
  t.assert(destroyed === 1)
  // a top-level type is torn down when its Doc is destroyed
  const ydoc2 = new Y.Doc()
  const ytext2 = ydoc2.get('text')
  let destroyed2 = 0
  ytext2.on('destroy', () => { destroyed2++ })
  ydoc2.destroy()
  t.assert(destroyed2 === 1)
}

/**
 * The `'delta'` event bubbles to ancestors on nested changes, like `observeDeep`. A listener on a
 * container fires (with the container-rooted delta) when a nested child is edited.
 */
export const testRdtDeltaBubblesLikeObserveDeep = () => {
  const ydoc = new Y.Doc()
  const yarray = ydoc.get('arr')
  const child = new Y.Node()
  yarray.insert(0, [child])
  let containerFired = 0
  let childFired = 0
  /**
   * @type {any}
   */
  let captured = null
  yarray.on('delta', d => { containerFired++; captured = d })
  child.on('delta', () => { childFired++ })
  child.insert(0, 'hi')
  // both the edited child and its ancestor container received a 'delta'
  t.assert(childFired === 1)
  t.assert(containerFired === 1)
  // the container-rooted delta is a non-empty (nested modify) change
  t.assert(captured !== null && !captured.isEmpty())
}

/**
 * `get delta()` returns the deep delta and keeps it current on every event of this type, including
 * nested-child edits (which apply as a nested `modify`). The returned value is the live cache.
 */
export const testRdtDeltaCacheMaintenance = () => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get('text')
  ytext.insert(0, 'hello')
  // first access materializes the cache
  t.assert(ytext.delta.equals(delta.create().insert('hello').done()))
  // a later edit updates the live cache in place
  const live = ytext.delta
  ytext.insert(5, ' world')
  t.assert(live === ytext.delta) // same maintained object
  t.assert(ytext.delta.equals(delta.create().insert('hello world').done()))
  t.assert(ytext.delta.equals(ytext.toDeltaDeep())) // matches a fresh deep render

  // nested: editing a child updates the container's cached deep delta via a nested modify apply
  const yarray = ydoc.get('arr')
  const child = new Y.Node()
  yarray.insert(0, [child])
  child.insert(0, 'a')
  const before = yarray.delta // materialize under base renderer
  child.insert(1, 'b') // nested edit after materialization
  t.assert(before === yarray.delta)
  t.assert(yarray.delta.equals(yarray.toDeltaDeep()))
}

/**
 * `clearCache()` drops the maintained deep delta; the next `delta` access re-materializes it.
 */
export const testRdtClearCache = () => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get('text')
  ytext.insert(0, 'hello')
  const d1 = ytext.delta
  t.assert(ytext._delta !== null)
  ytext.clearCache()
  t.assert(ytext._delta === null)
  const d2 = ytext.delta // re-materialized, a fresh builder
  t.assert(d2 !== d1)
  t.assert(d2.equals(delta.create().insert('hello').done()))
}

/**
 * `useRenderer` re-renders the maintained delta with the new renderer, emits the difference on the
 * `'delta'` channel, and updates the cache.
 */
export const testRdtUseRendererEmitsDiff = () => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.get('text')
  ytext.insert(0, 'hello world')
  const v1 = Y.cloneDoc(ydoc)
  ydoc.transact(() => { ytext.delete(6, 5) })
  // materialize the cache under the base renderer
  t.assert(ytext.delta.equals(delta.create().insert('hello ').done()))
  /**
   * @type {any}
   */
  let captured = null
  ytext.on('delta', d => { captured = d })
  ytext.useRenderer(Y.createDiffRenderer(v1, ydoc))
  // a non-empty rendering diff was emitted only on the 'delta' channel
  t.assert(captured !== null && !captured.isEmpty())
  // and the cache now reflects the diff-rendered state
  t.assert(ytext.delta.equals(delta.create().insert('hello ').insert('world', null, { delete: [] }).done()))
}

/**
 * `YNode` conforms to the lib0 `RDT` interface — verified at runtime with `$rdt.check` (replaces the
 * old compile-time `_assertYNodeIsRdt`).
 */
export const testRdtConformsToRdtSchema = () => {
  t.assert($rdt.check(new Y.Doc().get()))
  t.assert($rdt.check(new Y.Node()))
  t.assert(!$rdt.check({}))
  t.assert(!$rdt.check(null))
}

/**
 * Collect a type and all of its (non-deleted) nested `YNode` descendants.
 *
 * @param {Y.Node<any>} root
 * @return {Array<Y.Node<any>>}
 */
const collectTypes = root => {
  /**
   * @type {Array<Y.Node<any>>}
   */
  const out = [root]
  for (let i = 0; i < out.length; i++) {
    out[i].forEach(c => { if (c instanceof Y.Node) out.push(c) })
    out[i].forEachAttr(v => { if (v instanceof Y.Node) out.push(v) })
  }
  return out
}

/**
 * Apply one random mutation to a random type in the tree rooted at `root`.
 *
 * @param {prng.PRNG} gen
 * @param {Y.Node<any>} root
 */
const applyRandomYNodeOp = (gen, root) => {
  const target = prng.oneOf(gen, collectTypes(root))
  switch (prng.int32(gen, 0, 4)) {
    case 0: // insert text
      target.insert(prng.int32(gen, 0, target.length), prng.word(gen))
      break
    case 1: // insert a nested type
      target.insert(prng.int32(gen, 0, target.length), [new Y.Node()])
      break
    case 2: // delete a range
      if (target.length > 0) {
        const p = prng.int32(gen, 0, target.length - 1)
        target.delete(p, prng.int32(gen, 1, math.min(3, target.length - p)))
      }
      break
    case 3: // format a range (add or remove bold)
      if (target.length > 0) {
        const p = prng.int32(gen, 0, target.length - 1)
        target.format(p, prng.int32(gen, 1, math.min(3, target.length - p)), { bold: prng.bool(gen) ? true : null })
      }
      break
    case 4: // set / delete a map attribute
      if (prng.bool(gen)) {
        target.setAttr(prng.oneOf(gen, ['a', 'b', 'c']), prng.word(gen))
      } else {
        target.deleteAttr(prng.oneOf(gen, ['a', 'b', 'c']))
      }
      break
  }
}

/**
 * Assert the maintained `.delta` cache of `type` is (a) structurally correct — equals a fresh
 * `toDelta({ deep: true })` — and (b) fingerprint-memo-fresh — its (possibly memoized)
 * `fingerprint` equals a `delta.cloneDeep` recompute (cloneDeep rebuilds every node memo-free,
 * so it is a true recompute oracle at every depth; `clone`/`slice` are not — they share frozen
 * nested deltas by reference).
 *
 * Reading `.fingerprint` also (re)memoizes it on the LIVE cache at every depth — exactly what a
 * y-sync-style consumer does when diffing against `type.delta` — so the NEXT in-place cache patch
 * hits an already-fingerprinted tree and any missing memo invalidation surfaces on the next call.
 *
 * Diagnosis: `equals` fail = cache drift; `equals` pass + fingerprint mismatch = stale memo
 * (a mutation reached the cache without routing through the lib0 builder API — see the
 * `YNode._delta` invariant in src/ynode.js).
 *
 * @param {Y.Node<any>} type
 * @param {string} msg
 */
const assertDeltaCacheFresh = (type, msg) => {
  const cached = type.delta
  const memoFp = cached.fingerprint // reads (and re-populates) the memo on the live cache
  const fresh = type.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error(`${msg} cached :`, JSON.stringify(cached.toJSON()))
    console.error(`${msg} toDelta:`, JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), `${msg}: maintained .delta drifted from toDelta({ deep: true })`)
  t.assert(memoFp === delta.cloneDeep(/** @type {any} */ (cached)).fingerprint,
    `${msg}: stale fingerprint memo on the live .delta cache`)
}

/**
 * Fuzz: after each random mutation, every type's maintained `delta` cache (at every nesting level)
 * must equal a fresh deep render `toDelta({ deep: true })`.
 *
 * @param {t.TestCase} tc
 */
export const testRdtDeltaFuzz = tc => {
  const ydoc = new Y.Doc()
  const root = ydoc.get('root')
  for (let i = 0; i < 300; i++) {
    applyRandomYNodeOp(tc.prng, root)
    collectTypes(root).forEach(type =>
      t.assert(type.delta.equals(type.toDelta({ deep: true })), `iter ${i}`))
  }
}

/**
 * Fuzz pin: fingerprint-memo safety of the maintained `.delta` cache under in-place patching
 * (the per-transaction `type._delta?.apply(change)` path in `cleanupTransactions`).
 * Reading `.fingerprint` each iteration memoizes on the live cache of every type (root deep
 * cache AND each nested type's own cache); the next random transaction then patches
 * already-fingerprinted trees, and the memo must equal a full `delta.cloneDeep` recompute.
 * `testRdtDeltaFuzz` above is the memo-free control: if only this test fails, the drift is a
 * stale fingerprint memo, not a structural one.
 *
 * @param {t.TestCase} tc
 */
export const testRdtFingerprintMemoFuzzCacheDrift = tc => {
  const ydoc = new Y.Doc()
  const root = ydoc.get('root')
  for (let i = 0; i < 300; i++) {
    applyRandomYNodeOp(tc.prng, root)
    collectTypes(root).forEach(type => assertDeltaCacheFresh(type, `iter ${i}`))
  }
}

/**
 * Fuzz under a diffing renderer, across two synced replicas. Each replica is a "suggestion doc" that
 * diffs against its own fixed baseline clone (taken after some shared initial content). With the plain
 * diff renderer (no `attrs`), suggestion inserts render `{ insert: [] }` and deletes render
 * `{ delete: [] }` — identical on every replica — so the maintained, diff-attributed `delta` must
 * converge across replicas (and match a fresh deep render). The cache is kept current purely by the
 * `'delta'` event (no recompute). Also memo-pressures both replicas' live caches via fingerprint
 * reads each iteration (see `assertDeltaCacheFresh`) — these consume no prng, so seeds reproduce.
 *
 * @param {t.TestCase} tc
 */
export const testRdtDeltaSuggestionConvergence = tc => {
  const { testConnector, users } = init(tc, { users: 2 })
  const [d0, d1] = users
  d0.get('root').insert(0, 'shared baseline content')
  testConnector.flushAllMessages()
  // each replica diffs against its own fixed baseline clone (plain diff renderer => {insert:[]}/{delete:[]})
  d0.get('root').useRenderer(Y.createDiffRenderer(Y.cloneDoc(d0), d0))
  d1.get('root').useRenderer(Y.createDiffRenderer(Y.cloneDoc(d1), d1))
  for (let i = 0; i < 300; i++) {
    applyRandomYNodeOp(tc.prng, prng.oneOf(tc.prng, users).get('root')) // includes format add/remove
    testConnector.flushAllMessages()
    const a = d0.get('root').delta
    const b = d1.get('root').delta
    t.assert(a.equals(b), `converge iter ${i}`) // the suggestion view is replica-independent
    // matches a fresh render, and the fingerprint memos survive the in-place cache patches
    assertDeltaCacheFresh(d0.get('root'), `iter ${i} (d0)`)
    assertDeltaCacheFresh(d1.get('root'), `iter ${i} (d1)`)
  }
}

/**
 * Regression (deterministic, seed 1): removing a format under a diffing renderer must keep the
 * incrementally-maintained `.delta` equal to a fresh `toDelta({ deep: true })`. The bug was in the
 * `ContentFormat` change-mode block of `toDelta` (src/ynode.js): un-formatting cleared the format
 * *value* but emitted only a context-skip for the format-*attribution*, so the maintained cache kept
 * a stale `{attribution:{format:{bold:[]}}}` on the un-formatted range and drifted (at iter 35). The
 * fix emits an explicit `attribution:{format:{<key>:null}}` clear on the retained range (only in a
 * change/diff render). This test pins that behavior; if it regresses, the drift reappears at iter 35.
 */
export const testRdtFormatRemovalDrift = () => {
  const gen = prng.create(1) // fixed seed → deterministic
  const docs = [new Y.Doc(), new Y.Doc()]
  const [d0, d1] = docs
  const sync = () => {
    Y.applyUpdate(d1, Y.encodeStateAsUpdate(d0, Y.encodeStateVector(d1)))
    Y.applyUpdate(d0, Y.encodeStateAsUpdate(d1, Y.encodeStateVector(d0)))
  }
  d0.get('root').insert(0, 'shared baseline content')
  sync()
  // each replica diffs against its own fixed baseline clone
  d0.get('root').useRenderer(Y.createDiffRenderer(Y.cloneDoc(d0), d0))
  d1.get('root').useRenderer(Y.createDiffRenderer(Y.cloneDoc(d1), d1))
  for (let i = 0; i < 40; i++) {
    applyRandomYNodeOp(gen, prng.oneOf(gen, docs).get('root'))
    sync()
    // read `.delta` every step so it is maintained incrementally (a single read at the end would
    // recompute fresh and hide the drift). The maintained delta MUST equal a fresh deep render.
    const cached = d0.get('root').delta
    const fresh = d0.get('root').toDelta({ deep: true })
    if (!cached.equals(fresh)) {
      console.error('iter ' + i + ' cached :', JSON.stringify(cached.toJSON()))
      console.error('iter ' + i + ' toDelta:', JSON.stringify(fresh.toJSON()))
    }
    t.assert(cached.equals(fresh), `iter ${i}: maintained .delta drifted from toDelta({ deep: true })`)
  }
}

/**
 * Regression (minimal, deterministic, no prng): re-bolding content by deleting a transient `bold:null`
 * marker under a diffing renderer must keep the maintained `delta` equal to a fresh deep render.
 *
 * Steps: bold all of "abcdef", un-bold "cd" (inserts a `bold:null` marker), then re-bold "cd" (which
 * DELETES that marker). The deleted marker surfaces `attrs == null` in the change render, so the
 * attribution context must be *preserved* (not cleared) for the re-bolded run; a fresh render sees the
 * resulting attributed `bold:true` marker and renders `{format:{bold:[]}}`, so the cache must match:
 *
 *   .delta == toDelta({deep}) == "abcdef"{bold, attr:{format:{bold:[]}}}
 */
export const testRdtFormatRebold = () => {
  const doc = new Y.Doc()
  const root = doc.get('root')
  root.insert(0, 'abcdef')
  // diff against a baseline taken BEFORE formatting => every format change is an attributed suggestion
  root.useRenderer(Y.createDiffRenderer(Y.cloneDoc(doc), doc))
  // first access starts maintaining the incremental cache (baseline == current, so no suggestions yet)
  t.assert(root.delta.equals(delta.create().insert('abcdef').done()))
  root.format(0, 6, { bold: true }) // all bold
  root.format(2, 2, { bold: null }) // un-bold "cd" (inserts a transient bold:null marker)
  root.format(2, 2, { bold: true }) // re-bold "cd" => DELETES that transient marker
  const cached = root.delta
  const fresh = root.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('rebold cached :', JSON.stringify(cached.toJSON()))
    console.error('rebold toDelta:', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta drifted from toDelta({ deep: true }) after re-bold')
}

/**
 * Regression (was a known bug — minimal, deterministic, no prng): inserting an embed (nested `Y.Node`)
 * into a bold run used to leave a spurious `attribution:{format:{bold:null}}` null-leaf on the embed in
 * the maintained `delta`, where a fresh deep render has none. Now fixed; this pins it.
 *
 * Two ops: bold "ab", then insert an embed between "a" and "b". Inserting into a formatted run makes
 * Yjs surround the embed with NEGATED markers (`[bold:null] <embed> [bold:true]`) so the embed is not
 * bold. In the change render of that insert, the new `bold:null` negation marker triggers the
 * format-attribution clear (a `null` leaf), and because the embed is a FRESH renderContent insert it
 * inherits that leaf — but unlike a text insert the null-leaf does NOT resolve away for a `ContentType`
 * (embed) insert, so it sticks in the cache. A full render (insert mode) never emits the leaf:
 *
 *   maintained .delta : "a"{bold,attr} | <embed>{attr:{format:{bold:null}, insert:[]}} | "b"{bold,attr}
 *   toDelta({deep})   : "a"{bold,attr} | <embed>{attr:{insert:[]}}                      | "b"{bold,attr}
 *
 * Root cause: the single `usedAttribution` context can't distinguish inserts (need absolute attribution,
 * no null-leaves) from retains (need the null-leaf clear) — the value dimension already splits these
 * (`currentFormats` for inserts vs `changedFormats` for retains); the attribution dimension does
 * not. (Note: a *third* op `format(1,1,{bold:null})` to un-bold the embed is a no-op — the embed is
 * already not bold — so it produces an empty transaction and fires no `'delta'` event.)
 */
export const testRdtFormatEmbedInBold = () => {
  const doc = new Y.Doc()
  const root = doc.get('root')
  root.insert(0, 'ab')
  root.useRenderer(Y.createDiffRenderer(Y.cloneDoc(doc), doc))
  // first access starts maintaining the incremental cache (baseline == current, so no suggestions yet)
  t.assert(root.delta.equals(delta.create().insert('ab').done()))
  root.format(0, 2, { bold: true }) // bold "ab"
  root.insert(1, [new Y.Node()]) // insert an embed inside the bold run: "a<T>b"
  const cached = root.delta
  const fresh = root.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('embed-in-bold cached :', JSON.stringify(cached.toJSON()))
    console.error('embed-in-bold toDelta:', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta drifted from toDelta({ deep: true }) after embed-in-bold insert')
}

/**
 * Regression (minimal, deterministic, no prng): formatting a char and then deleting it under a diffing
 * renderer used to leave the maintained `delta` with a stale bold value + `{format:{bold:[]}}`
 * attribution on the deleted char, where a fresh deep render keeps only the `{delete:[]}` suggestion.
 *
 *   maintained .delta : "a" { format:{bold:true}, attribution:{ format:{bold:[]}, delete:[] } }  (was)
 *   toDelta({deep})   : "a" { attribution:{ delete:[] } }                                        (correct)
 *
 * On delete, the format markers around the char are cleaned up (deleted) too; their insert+delete
 * suggestion nets to no attribution, so the change render skipped them and never undid the value +
 * attribution the format step had written to the cache. The fix (in `toDelta`): a retain emits the
 * format *diff* (`changedFormats`, which carries the `bold→null` clear), and a deleted format marker
 * that actually removes a format under an attributing renderer emits an explicit `{format:{<key>:null}}`
 * attribution clear. This was the stale-`{format:{bold:[]}}`-on-deleted-content (re-assert) class.
 */
export const testRdtFormatDeleteFormatted = () => {
  const doc = new Y.Doc()
  const root = doc.get('root')
  root.insert(0, 'a')
  root.useRenderer(Y.createDiffRenderer(Y.cloneDoc(doc), doc)) // baseline before formatting
  // start maintaining the incremental cache (baseline == current, so no suggestions yet)
  t.assert(root.delta.equals(delta.create().insert('a').done()))
  root.format(0, 1, { bold: true }) // bold "a"
  root.delete(0, 1) // delete "a"
  const cached = root.delta
  const fresh = root.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('delete-formatted cached :', JSON.stringify(cached.toJSON()))
    console.error('delete-formatted toDelta:', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta drifted from toDelta({ deep: true }) after format+delete')
}

/**
 * Sanity: the maintained `delta` equals both an explicit expected delta and a fresh deep render —
 * for flat content, nested children, and ongoing edits.
 */
export const testRdtDeltaSanity = () => {
  const ydoc = new Y.Doc()
  const root = ydoc.get('root')
  root.insert(0, 'hello')
  root.setAttr('k', 'v')
  t.assert(root.delta.equals(delta.create().insert('hello').setAttr('k', 'v').done()))
  t.assert(root.delta.equals(root.toDelta({ deep: true })))
  // nested child + ongoing edits keep delta == fresh deep render
  const child = new Y.Node()
  root.insert(5, [child])
  child.insert(0, 'world')
  t.assert(root.delta.equals(root.toDelta({ deep: true })))
  child.insert(5, '!')
  root.delete(0, 1)
  t.assert(root.delta.equals(root.toDelta({ deep: true })))
  // the nested child's own cache is consistent too
  t.assert(child.delta.equals(child.toDelta({ deep: true })))
  t.assert(child.delta.equals(delta.create().insert('world!').done()))
}

/**
 * Sanity: under a diffing-attribution renderer the maintained `delta` carries the expected
 * attribution markers and equals a fresh attributed deep render.
 */
export const testRdtDeltaAttributionSanity = () => {
  const ydoc = new Y.Doc()
  const root = ydoc.get('root')
  const v1 = Y.cloneDoc(ydoc)
  const attributions = Y.createContentMap()
  ydoc.on('update', (update, _origin, doc, tr) => {
    if (!tr.local) return
    const uid = doc.clientID.toString()
    const cids = Y.createContentIdsFromUpdate(update)
    Y.insertIntoIdMap(attributions.inserts, Y.createIdMapFromIdSet(cids.inserts, [Y.createContentAttribute('insert', uid)]))
    Y.insertIntoIdMap(attributions.deletes, Y.createIdMapFromIdSet(cids.deletes, [Y.createContentAttribute('delete', uid)]))
  })
  root.insert(0, 'hello') // a suggestion relative to v1
  const uid = ydoc.clientID.toString()
  root.useRenderer(Y.createDiffRenderer(v1, ydoc, { attributions }))
  t.assert(root.delta.equals(delta.create().insert('hello', null, { insert: [uid] }).done()))
  t.assert(root.delta.equals(root.toDelta({ deep: true })))
}

/**
 * Regression pin (originally a failing repro): formatting across a suggestion-deleted range with an
 * accepting renderer (suggestionMode=false) drifts the maintained `.delta`
 * cache — the change render attributes the formatted runs
 * (`{format:{code:[]}}`) while a fresh deep render nets no format attribution
 * (the format committed to base; it is not a suggestion). Also reproduces with
 * two independent renderers on separate suggestion docs (fixed suggestionMode
 * flags), i.e. without flipping the flag: a suggestion-mode peer deletes, a
 * view-suggestions peer formats across the deleted range.
 */
export const testRdtFormatAcrossSuggestionDeletedDrift = () => {
  const doc = new Y.Doc({ gc: false })
  const suggestionDoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
  const renderer = Y.createDiffRenderer(doc, suggestionDoc, { attributions: Y.createContentMap() })
  doc.get('prosemirror').applyDelta(
    delta.create().insert([delta.create('paragraph', {}, 'hello world')]).done()
  )
  const ynode = suggestionDoc.get('prosemirror')
  ynode.useRenderer(renderer)
  t.assert(ynode.delta != null) // materialize the maintained cache
  // suggestion-delete "llo " (stays a suggestion; still rendered, attributed)
  renderer.suggestionMode = true
  ynode.applyDelta(delta.create().modify(delta.create().retain(2).delete(4)).done())
  // as an accepting user, format across the still-rendered deleted range
  renderer.suggestionMode = false
  ynode.applyDelta(delta.create().modify(delta.create().retain(1).retain(6, { code: {} })).done())
  const cached = ynode.delta
  const fresh = ynode.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render')
}

/**
 * Fixture for the delivery-through-deleted-parents tests: base doc + suggestion doc with pinned
 * clientIDs (item/marker order at equal positions depends on clientID comparison — always pin, and
 * exercise both orderings where it matters), a `paragraph('hello world')` created on the base doc
 * (flows into the suggestion doc through the renderer), and optionally the diff renderer attached
 * to the suggestion doc's root.
 *
 * @param {number} baseClientID
 * @param {number} sdocClientID
 * @param {boolean} useRootRenderer
 */
const createSuggestionPair = (baseClientID, sdocClientID, useRootRenderer = true) => {
  const doc = new Y.Doc({ gc: false })
  doc.clientID = baseClientID
  const sdoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sdoc.clientID = sdocClientID
  const renderer = Y.createDiffRenderer(doc, sdoc, { attributions: Y.createContentMap() })
  doc.get('prosemirror').applyDelta(
    delta.create().insert([delta.create('paragraph', {}, 'hello world')]).done()
  )
  const ynode = sdoc.get('prosemirror')
  if (useRootRenderer) ynode.useRenderer(renderer)
  return { doc, sdoc, renderer, ynode }
}

/**
 * A remote base-doc insert into a suggestion-deleted paragraph must reach the root's RDT surface:
 * the tombstone is still rendered by the diff renderer, so the change is visible. The event
 * bubbles through the deleted parent (tracked unconditionally in `changedParentTypes`, fired on
 * live ancestors), and the freshly inserted content — auto-deleted with its parent in the same
 * transaction (`insertSet ∩ deleteSet`) yet attributed by the renderer — renders as a fresh
 * insert carrying its delete attribution (`itemsToRender` includes `I∩D ∩ renderer.attributed`),
 * so the maintained cache stays equal to a fresh deep render.
 */
export const testRdtDeltaThroughDeletedParent = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const { doc, ynode } = createSuggestionPair(baseClientID, sdocClientID)
    t.assert(ynode.delta != null) // materialize the maintained cache
    let fired = 0
    /**
     * @type {any}
     */
    let captured = null
    ynode.on('delta', d => { fired++; captured = d })
    // suggestion-delete the whole paragraph (stays rendered as an attributed tombstone)
    ynode.applyDelta(delta.create().delete(1).done())
    t.assert(fired === 1)
    fired = 0
    // remote base edit inside the tombstone: integrates under the deleted paragraph in the
    // suggestion doc (and is auto-deleted with it) — must still fire the root's 'delta'
    doc.get('prosemirror').applyDelta(delta.create().modify(delta.create().retain(2).insert('XY')).done())
    t.assert(fired === 1, 'root delta fires for a change inside a suggestion-deleted paragraph')
    t.assert(captured !== null && !captured.isEmpty())
    const fresh = ynode.toDelta({ deep: true })
    t.assert(JSON.stringify(fresh.toJSON()).includes('XY'), 'fresh render shows the text inside the tombstone')
    const cached = ynode.delta
    if (!cached.equals(fresh)) {
      console.error('cached:', JSON.stringify(cached.toJSON()))
      console.error('fresh :', JSON.stringify(fresh.toJSON()))
    }
    t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render')
  }
}

/**
 * A remote base-doc insert of a whole *nested type* into a suggestion-deleted paragraph: the
 * fresh paragraph and all of its content are auto-deleted on integration yet attributed by the
 * renderer, so the change renders it as a deep fresh insert (mode-3 through the ContentType
 * branch) and the maintained cache stays equal to a fresh deep render.
 */
export const testRdtDeltaFreshTypeThroughDeletedParent = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const { doc, ynode } = createSuggestionPair(baseClientID, sdocClientID)
    t.assert(ynode.delta != null) // materialize the maintained cache
    let fired = 0
    ynode.on('delta', () => { fired++ })
    // suggestion-delete the whole paragraph (stays rendered as an attributed tombstone)
    ynode.applyDelta(delta.create().delete(1).done())
    fired = 0
    // remote base edit: insert a fresh nested paragraph inside the tombstone
    const freshParagraph = /** @type {any} */ (delta.create('paragraph', {}, 'fresh'))
    const inner = /** @type {any} */ (delta.create().retain(2).insert([freshParagraph]))
    doc.get('prosemirror').applyDelta(delta.create().modify(inner).done())
    t.assert(fired === 1, 'root delta fires for a fresh nested type inside a suggestion-deleted paragraph')
    const fresh = ynode.toDelta({ deep: true })
    t.assert(JSON.stringify(fresh.toJSON()).includes('fresh'), 'fresh render shows the nested type inside the tombstone')
    const cached = ynode.delta
    if (!cached.equals(fresh)) {
      console.error('cached:', JSON.stringify(cached.toJSON()))
      console.error('fresh :', JSON.stringify(fresh.toJSON()))
    }
    t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render')
  }
}

/**
 * Content inserted AND suggestion-deleted within the same transaction renders as nothing (a
 * suggested insert that was taken back is invisible), and the maintained cache stays consistent —
 * the `insertSet ∩ deleteSet` handling must not leak invisible content into the rendered state.
 */
export const testRdtDeltaSuggestedInsertThenDeleteInvisible = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const { sdoc, ynode } = createSuggestionPair(baseClientID, sdocClientID)
    t.assert(ynode.delta != null) // materialize the maintained cache
    // insert and delete the same content in ONE transaction on the suggestion doc
    sdoc.transact(() => {
      const par = /** @type {Y.Node} */ (ynode.get(0))
      par.applyDelta(delta.create().retain(2).insert('zz').done())
      par.applyDelta(delta.create().retain(2).delete(2).done())
    })
    const fresh = ynode.toDelta({ deep: true })
    t.assert(!JSON.stringify(fresh.toJSON()).includes('zz'), 'insert-then-deleted suggestion is invisible')
    const cached = ynode.delta
    if (!cached.equals(fresh)) {
      console.error('cached:', JSON.stringify(cached.toJSON()))
      console.error('fresh :', JSON.stringify(fresh.toJSON()))
    }
    t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render')
  }
}

/**
 * Freshness (mode 3) must be decided per id range, not per item: a nested transaction (created
 * from a 'delta' observer during another transaction's emit loop) has its freshly
 * inserted+deleted item merged into an older left neighbor by the OUTER transaction's cleanup
 * (`tryToMergeWithLefts`) before the nested transaction's events render. With a whole-item check
 * (`insertedItems.hasId(item.id)` — first id only) the fresh range would render as a spurious
 * `delete` op, removing content the cache legitimately holds.
 */
export const testRdtDeltaFreshRangeAfterItemMerge = () => {
  const doc = new Y.Doc({ gc: false })
  doc.clientID = 1
  const sdoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sdoc.clientID = 2
  const renderer = Y.createDiffRenderer(doc, sdoc, { attributions: Y.createContentMap() })
  doc.get('t').applyDelta(delta.create().insert('XY').done())
  const ynode = sdoc.get('t')
  ynode.useRenderer(renderer)
  t.assert(ynode.delta != null) // materialize the maintained cache
  let reacted = false
  ynode.on('delta', change => {
    if (reacted || !JSON.stringify(change.toJSON()).includes('"a"')) return
    reacted = true
    // nested transaction, cleaned up after the outer one: insert 'b' right after the suggested
    // 'a' (adjacent clock, same client), then delete both — the outer cleanup merges the two
    // deleted items into one before this transaction's events render
    sdoc.transact(() => {
      ynode.applyDelta(delta.create().retain(1).insert('b').done())
      ynode.applyDelta(delta.create().delete(2).done())
    })
  })
  // outer transaction: suggested insert 'a' at position 0
  ynode.applyDelta(delta.create().insert('a').done())
  t.assert(reacted)
  const cached = ynode.delta
  const fresh = ynode.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render')
}

/**
 * The lib0 `RDT` fix contract for a *fully reverted* apply: nothing landed on the doc, the
 * maintained cache stays consistent, and `before.apply(d).apply(fix)` round-trips back to the
 * actual (unchanged) rendered state — the fix is the inverse of the unapplied change.
 *
 * @param {any} ynode the type whose maintained `.delta` cache to check (must be materialized)
 * @param {any} before deep render of `ynode` captured before the apply
 * @param {any} d the change that was (not) applied
 * @param {any} fix the fix `applyDelta` returned
 */
const assertRevertedApply = (ynode, before, d, fix) => {
  const fresh = ynode.toDelta({ deep: true })
  t.assert(delta.diff(before, fresh).isEmpty(), 'nothing was applied to the doc')
  t.assert(ynode.delta.equals(fresh), 'maintained .delta must equal a fresh deep render')
  const roundTrip = delta.cloneDeep(before)
  roundTrip.apply(delta.cloneDeep(d), { final: true, move: true })
  if (fix !== null) {
    roundTrip.apply(delta.cloneDeep(fix), { final: true, move: true })
  }
  t.assert(delta.diff(roundTrip, fresh).isEmpty(), 'the fix round-trips the expected state back to the actual state')
}

/**
 * Modifying a suggestion-deleted (rendered) node must not apply anything — `applyDelta` returns
 * the reverted operation (the inverse of the nested change) as the RDT fix, emits no 'delta'
 * event (nothing changed), and leaves doc + cache untouched.
 */
export const testRdtApplyDeltaModifyIntoTombstoneReturnsInverse = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const { ynode } = createSuggestionPair(baseClientID, sdocClientID)
    t.assert(ynode.delta != null) // materialize the maintained cache
    ynode.applyDelta(delta.create().delete(1).done())
    const before = ynode.toDelta({ deep: true })
    let fired = 0
    ynode.on('delta', () => { fired++ })
    const d = delta.create().modify(delta.create().retain(2).insert('XY')).done()
    const fix = ynode.applyDelta(d)
    t.assert(fix !== null, 'the reverted operation is returned')
    t.compare(/** @type {any} */ (fix).toJSON(), delta.create().modify(delta.create().retain(2).delete(2)).done().toJSON())
    t.assert(fired === 0, 'a fully reverted apply emits no delta event')
    t.assert(!JSON.stringify(ynode.toDelta({ deep: true }).toJSON()).includes('XY'), 'the insert was not applied')
    assertRevertedApply(ynode, before, d, fix)
  }
}

/**
 * Deleting content inside a tombstone: the fix re-inserts the deleted range from the rendered
 * base state, restoring its stored attribution (the caller's view shows the content
 * delete-attributed — the revert must bring exactly that back).
 */
export const testRdtApplyDeltaDeleteInsideTombstoneInverse = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const { ynode } = createSuggestionPair(baseClientID, sdocClientID)
    t.assert(ynode.delta != null)
    ynode.applyDelta(delta.create().delete(1).done())
    const before = ynode.toDelta({ deep: true })
    const d = delta.create().modify(delta.create().retain(2).delete(4)).done()
    const fix = ynode.applyDelta(d)
    t.assert(fix !== null)
    const fixJson = JSON.stringify(/** @type {any} */ (fix).toJSON())
    t.assert(fixJson.includes('llo '), 'the fix re-inserts the deleted range')
    t.assert(fixJson.includes('"delete"'), 'the re-insert restores the stored delete attribution')
    assertRevertedApply(ynode, before, d, fix)
  }
}

/**
 * Formatting content inside a tombstone: not applied (no markers created); the fix clears the
 * format keys back to the base values (`{ bold: null }` for a previously unformatted range).
 */
export const testRdtApplyDeltaFormatInsideTombstoneInverse = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const { ynode } = createSuggestionPair(baseClientID, sdocClientID)
    t.assert(ynode.delta != null)
    ynode.applyDelta(delta.create().delete(1).done())
    const before = ynode.toDelta({ deep: true })
    const d = delta.create().modify(delta.create().retain(1).retain(4, { bold: {} })).done()
    const fix = ynode.applyDelta(d)
    t.assert(fix !== null)
    t.compare(/** @type {any} */ (fix).toJSON(), delta.create().modify(delta.create().retain(1).retain(4, { bold: null })).done().toJSON())
    assertRevertedApply(ynode, before, d, fix)
  }
}

/**
 * A `modify` carrying node formats on a tombstone: `op.format` is not applied either, and the fix
 * restores the *previous* format value — read from the cursor's format context AFTER stepping to
 * the node, so an alive format marker between the walk's start and the node is accounted for.
 */
export const testRdtApplyDeltaNodeFormatOnTombstoneInverse = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const doc = new Y.Doc({ gc: false })
    doc.clientID = baseClientID
    const sdoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
    sdoc.clientID = sdocClientID
    const renderer = Y.createDiffRenderer(doc, sdoc, { attributions: Y.createContentMap() })
    doc.get('prosemirror').applyDelta(
      delta.create().insert([delta.create('paragraph', {}, 'aa'), delta.create('paragraph', {}, 'bb')]).done()
    )
    // base-doc node format over both paragraphs: an alive `align` marker sits before the first one
    doc.get('prosemirror').applyDelta(delta.create().retain(2, { align: 'x' }).done())
    const ynode = sdoc.get('prosemirror')
    ynode.useRenderer(renderer)
    t.assert(ynode.delta != null)
    // suggestion-delete the second paragraph
    ynode.applyDelta(delta.create().retain(1).delete(1).done())
    const before = ynode.toDelta({ deep: true })
    const d = delta.create().retain(1).modify(delta.create(), { align: 'y' }).done()
    const fix = ynode.applyDelta(d)
    t.assert(fix !== null)
    t.compare(/** @type {any} */ (fix).toJSON(), delta.create().retain(1).modify(delta.create(), { align: 'x' }).done().toJSON())
    assertRevertedApply(ynode, before, d, fix)
  }
}

/**
 * Applied and reverted ops coexist in one delta: ops on live content land (one 'delta' event),
 * only the tombstone-targeting modify reverts — and the fix's retain pad is measured in the
 * caller's *expected* space (including `d`'s own earlier insert).
 */
export const testRdtApplyDeltaMixedFixCoordinates = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const doc = new Y.Doc({ gc: false })
    doc.clientID = baseClientID
    const sdoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
    sdoc.clientID = sdocClientID
    const renderer = Y.createDiffRenderer(doc, sdoc, { attributions: Y.createContentMap() })
    doc.get('prosemirror').applyDelta(
      delta.create().insert([
        delta.create('paragraph', {}, 'aa'), delta.create('paragraph', {}, 'hello world'), delta.create('paragraph', {}, 'cc')
      ]).done()
    )
    const ynode = sdoc.get('prosemirror')
    ynode.useRenderer(renderer)
    t.assert(ynode.delta != null)
    // suggestion-delete the middle paragraph
    ynode.applyDelta(delta.create().retain(1).delete(1).done())
    let fired = 0
    ynode.on('delta', () => { fired++ })
    const innerXY = /** @type {any} */ (delta.create().retain(2).insert('XY'))
    const innerZZ = /** @type {any} */ (delta.create().retain(2).insert('ZZ'))
    const pNew = /** @type {any} */ (delta.create('paragraph', {}, 'nn'))
    const d = /** @type {any} */ (delta.create()).insert([pNew]).retain(1).modify(innerXY).modify(innerZZ).done()
    const fix = ynode.applyDelta(d)
    t.assert(fired === 1, 'the applied part of the change emits exactly one delta event')
    t.assert(fix !== null)
    t.compare(/** @type {any} */ (fix).toJSON(), delta.create().retain(2).modify(delta.create().retain(2).delete(2)).done().toJSON())
    const fresh = JSON.stringify(ynode.toDelta({ deep: true }).toJSON())
    t.assert(fresh.includes('nn') && fresh.includes('ZZ'), 'ops on live content were applied')
    t.assert(!fresh.includes('XY'), 'the tombstone-targeting modify was not applied')
    t.assert(ynode.delta.equals(ynode.toDelta({ deep: true })), 'maintained .delta must equal a fresh deep render')
  }
}

/**
 * `modifyAttr` addressing a suggestion-deleted (still rendered) map value: the renderer-aware
 * lookup finds the tombstone, nothing is applied, and the fix wraps the inverse in a
 * `modifyAttr` — previously this hit `unexpectedCase` (`nodeMapGet` is blind to deleted items).
 */
export const testRdtApplyDeltaModifyAttrOnDeletedMapValue = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const doc = new Y.Doc({ gc: false })
    doc.clientID = baseClientID
    const sdoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
    sdoc.clientID = sdocClientID
    const renderer = Y.createDiffRenderer(doc, sdoc, { attributions: Y.createContentMap() })
    const title = doc.get('m').setAttr('title', new Y.Node())
    title.insert(0, 'hi')
    const m = sdoc.get('m')
    m.useRenderer(renderer)
    t.assert(m.delta != null)
    // suggestion-delete the attribute (stays rendered, delete-attributed)
    m.applyDelta(delta.create().deleteAttr('title').done())
    const before = m.toDelta({ deep: true })
    const d = delta.create().modifyAttr('title', delta.create().insert('X')).done()
    const fix = m.applyDelta(d)
    t.assert(fix !== null, 'no throw — the reverted operation is returned')
    t.compare(/** @type {any} */ (fix).toJSON(), delta.create().modifyAttr('title', delta.create().delete(1)).done().toJSON())
    assertRevertedApply(m, before, d, fix)
  }
}

/**
 * A plainly deleted (invisible — no renderer claims it) type keeps today's semantics: the apply
 * is silently dropped and `applyDelta` returns `null` (the caller's view shows nothing there, so
 * there is nothing to revert).
 */
export const testRdtApplyDeltaInvisibleDeletedSilentNull = () => {
  const doc = new Y.Doc({ gc: false })
  doc.clientID = 1
  const root = doc.get('prosemirror')
  root.applyDelta(delta.create().insert([delta.create('paragraph', {}, 'hello')]).done())
  const par = /** @type {Y.Node} */ (root.get(0))
  root.applyDelta(delta.create().delete(1).done())
  const res = par.applyDelta(delta.create().retain(2).insert('XY').done())
  t.assert(res === null, 'invisible deleted type: silent drop, no fix')
  t.assert(root.toDelta({ deep: true }).isEmpty(), 'nothing was applied')
}

/**
 * `applyDelta` called directly on a deleted-but-rendered type (the top-level guard): nothing is
 * applied and the inverse against the rendered state is returned. Without a renderer the same
 * call stays a silent `null` drop.
 */
export const testRdtApplyDeltaDirectGuardOnDeletedType = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const { ynode, renderer } = createSuggestionPair(baseClientID, sdocClientID)
    t.assert(ynode.delta != null)
    const par = /** @type {Y.Node} */ (ynode.get(0))
    ynode.applyDelta(delta.create().delete(1).done())
    const rootBefore = ynode.toDelta({ deep: true })
    const d = /** @type {any} */ (delta.create().retain(2).insert('XY').done())
    // children do not inherit the root's renderer — without one the node is invisible
    t.assert(par.applyDelta(d) === null, 'no renderer: silent drop')
    const fix = par.applyDelta(d, null, { renderer })
    t.assert(fix !== null)
    t.compare(/** @type {any} */ (fix).toJSON(), delta.create().retain(2).delete(2).done().toJSON())
    t.assert(delta.diff(rootBefore, ynode.toDelta({ deep: true })).isEmpty(), 'nothing was applied to the doc')
    t.assert(ynode.delta.equals(ynode.toDelta({ deep: true })), 'maintained .delta must equal a fresh deep render')
    // fix round-trip at the node level, against its rendered state
    const parBefore = /** @type {any} */ (par.toDelta({ deep: true, renderer }))
    const roundTrip = /** @type {any} */ (delta.cloneDeep(parBefore))
    roundTrip.apply(delta.cloneDeep(d), { final: true, move: true })
    roundTrip.apply(delta.cloneDeep(/** @type {any} */ (fix)), { final: true, move: true })
    t.assert(delta.diff(roundTrip, par.toDelta({ deep: true, renderer })).isEmpty(), 'the fix round-trips at the node level')
  }
}

/**
 * A tombstone grandchild behind an alive child: the alive child's applyDelta bubbles the nested
 * fix, and the parent wraps it positionally — `modify(modify(inverse))`.
 */
export const testRdtApplyDeltaNestedTombstoneFixBubbles = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const doc = new Y.Doc({ gc: false })
    doc.clientID = baseClientID
    const sdoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
    sdoc.clientID = sdocClientID
    const renderer = Y.createDiffRenderer(doc, sdoc, { attributions: Y.createContentMap() })
    doc.get('prosemirror').applyDelta(
      delta.create().insert([delta.create('paragraph', {}, [delta.create('nested', {}, 'ww')])]).done()
    )
    const ynode = sdoc.get('prosemirror')
    ynode.useRenderer(renderer)
    t.assert(ynode.delta != null)
    // suggestion-delete only the nested node inside the (alive) paragraph
    const par = /** @type {Y.Node} */ (ynode.get(0))
    par.applyDelta(delta.create().delete(1).done(), null, { renderer })
    const before = ynode.toDelta({ deep: true })
    const innerX = /** @type {any} */ (delta.create().insert('X'))
    const midModify = /** @type {any} */ (delta.create().modify(innerX))
    const d = delta.create().modify(midModify).done()
    const fix = ynode.applyDelta(d)
    t.assert(fix !== null)
    const innerDel = /** @type {any} */ (delta.create().delete(1))
    const midModifyDel = /** @type {any} */ (delta.create().modify(innerDel))
    t.compare(/** @type {any} */ (fix).toJSON(), delta.create().modify(midModifyDel).done().toJSON())
    assertRevertedApply(ynode, before, d, fix)
  }
}

/**
 * A plain `delete` op spanning a tombstone keeps its existing semantics (suggestion-deletes the
 * alive content, records the attributed range) and returns no fix — the known, downstream-healed
 * gap; pinned here so a change of behavior is a conscious one.
 */
export const testRdtApplyDeltaPureDeleteOverTombstoneNoFix = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const doc = new Y.Doc({ gc: false })
    doc.clientID = baseClientID
    const sdoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
    sdoc.clientID = sdocClientID
    const renderer = Y.createDiffRenderer(doc, sdoc, { attributions: Y.createContentMap() })
    doc.get('prosemirror').applyDelta(
      delta.create().insert([
        delta.create('paragraph', {}, 'aa'), delta.create('paragraph', {}, 'hello world'), delta.create('paragraph', {}, 'cc')
      ]).done()
    )
    const ynode = sdoc.get('prosemirror')
    ynode.useRenderer(renderer)
    t.assert(ynode.delta != null)
    ynode.applyDelta(delta.create().retain(1).delete(1).done())
    const res = ynode.applyDelta(delta.create().delete(3).done())
    t.assert(res === null, 'a plain delete over a tombstone range returns no fix')
    const fresh = ynode.toDelta({ deep: true })
    t.assert(ynode.delta.equals(fresh), 'maintained .delta must equal a fresh deep render')
  }
}

/**
 * A `delete` op ending mid-way through a struck (attributed-deleted) chunk must split the item at
 * the consumption boundary — otherwise the cursor advances past the whole chunk and every
 * following op of the same delta targets too far right (the modify walk then reverts the WRONG
 * node, returning a fix that carries another node's content).
 */
export const testRdtApplyDeltaDeleteMidStruckChunkKeepsCursorSync = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const doc = new Y.Doc({ gc: false })
    doc.clientID = baseClientID
    const sdoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
    sdoc.clientID = sdocClientID
    const renderer = Y.createDiffRenderer(doc, sdoc, { attributions: Y.createContentMap() })
    doc.get('t').applyDelta(delta.create().insert('abc').done())
    doc.get('t').applyDelta(delta.create().retain(3).insert([delta.create('nA', {}, 'kk'), delta.create('nB', {}, 'qqq')]).done())
    const ynode = sdoc.get('t')
    ynode.useRenderer(renderer)
    t.assert(ynode.delta != null)
    // strike 'bc' (one 2-unit chunk) and both nodes
    ynode.applyDelta(delta.create().retain(1).delete(2).done())
    ynode.applyDelta(delta.create().retain(3).delete(2).done())
    const before = ynode.toDelta({ deep: true })
    // delete struck 'b' (ends MID-chunk), retain struck 'c', revert-modify tombstone nA
    const inner = /** @type {any} */ (delta.create().delete(2))
    const d = delta.create().retain(1).delete(1).retain(1).modify(inner).done()
    const fix = ynode.applyDelta(d)
    t.assert(fix !== null)
    const fixJson = JSON.stringify(/** @type {any} */ (fix).toJSON())
    t.assert(fixJson.includes('kk') && !fixJson.includes('qq'), "the fix restores nA's content, not nB's")
    const fresh = ynode.toDelta({ deep: true })
    t.assert(delta.diff(before, fresh).isEmpty(), 'nothing was applied (struck delete is meta-only, modify reverted)')
    t.assert(ynode.delta.equals(fresh), 'maintained .delta must equal a fresh deep render')
  }
}

/**
 * A change *inside* a suggestion-deleted (still rendered) attr value must re-emit: the deleted
 * value has no modifyAttr path, so the change render re-emits the full-state `setAttr` (an
 * idempotent replace) whenever the value type is in `modified` — else the maintained cache and
 * every RDT consumer go permanently stale.
 */
export const testRdtDeltaThroughDeletedAttrValue = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const doc = new Y.Doc({ gc: false })
    doc.clientID = baseClientID
    const sdoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
    sdoc.clientID = sdocClientID
    const renderer = Y.createDiffRenderer(doc, sdoc, { attributions: Y.createContentMap() })
    const title = doc.get('m').setAttr('title', new Y.Node())
    title.insert(0, 'hi')
    const m = sdoc.get('m')
    m.useRenderer(renderer)
    t.assert(m.delta != null)
    m.applyDelta(delta.create().deleteAttr('title').done())
    t.assert(m.delta.equals(m.toDelta({ deep: true })), 'cache consistent after the suggestion deleteAttr')
    let fired = 0
    m.on('delta', () => { fired++ })
    // base-doc edit INSIDE the tombstone attr value
    doc.get('m').getAttr('title').insert(2, 'XY')
    t.assert(fired === 1, "'delta' fires for a change inside the tombstone attr value")
    const fresh = m.toDelta({ deep: true })
    t.assert(JSON.stringify(fresh.toJSON()).includes('XY'), 'fresh render shows the edit')
    t.assert(m.delta.equals(fresh), 'maintained .delta must equal a fresh deep render')
  }
}

/**
 * A remote base-doc format inside a suggestion-deleted paragraph: full contract — the root's
 * 'delta' fires and the maintained cache equals a fresh deep render (fresh-deleted format markers
 * stay on the retained-marker path of the format state machine).
 */
export const testRdtDeltaFormatThroughDeletedParent = () => {
  for (const [baseClientID, sdocClientID] of [[1, 2], [2, 1]]) {
    const { doc, ynode } = createSuggestionPair(baseClientID, sdocClientID)
    t.assert(ynode.delta != null) // materialize the maintained cache
    ynode.applyDelta(delta.create().delete(1).done()) // suggestion-delete the paragraph
    let fired = 0
    ynode.on('delta', () => { fired++ })
    doc.get('prosemirror').applyDelta(delta.create().modify(delta.create().retain(1).retain(4, { bold: {} })).done())
    t.assert(fired === 1, 'root delta fires for a format inside a suggestion-deleted paragraph')
    const cached = ynode.delta
    const fresh = ynode.toDelta({ deep: true })
    if (!cached.equals(fresh)) {
      console.error('cached:', JSON.stringify(cached.toJSON()))
      console.error('fresh :', JSON.stringify(fresh.toJSON()))
    }
    t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render')
  }
}

/**
 * Plain docs (base renderer): deleted content is invisible, so a remote change inside a deleted
 * paragraph emits no 'delta' (the change renders to an empty delta, which is suppressed) and v1
 * `observe` semantics are unchanged. Deep listeners on live ancestors ARE notified now (the event
 * is tracked through the deleted parent) — that is the chosen semantics.
 */
export const testRdtNoDeltaThroughDeletedParentPlainDoc = () => {
  const docP = new Y.Doc({ gc: false })
  docP.clientID = 3
  const docQ = new Y.Doc({ gc: false })
  docQ.clientID = 4
  docP.get('prosemirror').applyDelta(
    delta.create().insert([delta.create('paragraph', {}, 'hello world')]).done()
  )
  Y.applyUpdate(docQ, Y.encodeStateAsUpdate(docP))
  const rootQ = docQ.get('prosemirror')
  t.assert(rootQ.delta != null) // materialize the maintained cache
  let deltaFired = 0
  let deepFired = 0
  let observeFired = 0
  rootQ.on('delta', () => { deltaFired++ })
  rootQ.observeDeep(() => { deepFired++ })
  rootQ.observe(() => { observeFired++ })
  // plain-delete the paragraph on Q — a visible change, fires normally
  rootQ.applyDelta(delta.create().delete(1).done())
  t.assert(deltaFired === 1 && observeFired === 1)
  deltaFired = 0
  deepFired = 0
  observeFired = 0
  // remote edit inside the (invisible) deleted paragraph
  docP.get('prosemirror').applyDelta(delta.create().modify(delta.create().retain(2).insert('XY')).done())
  Y.applyUpdate(docQ, Y.encodeStateAsUpdate(docP))
  t.assert(deltaFired === 0, 'no delta emission for an invisible change')
  t.assert(observeFired === 0, 'v1 observe on the root is unaffected')
  t.assert(deepFired === 1, 'deep listeners on live ancestors are notified')
  t.assert(rootQ.delta.equals(rootQ.toDelta({ deep: true })), 'maintained cache stays equal to a fresh render')
}

/**
 * A deleted type with its OWN custom renderer keeps firing (its content is still rendered): the
 * deletion transaction and later remote edits inside the tombstone reach its `observe`/'delta'
 * and keep its maintained cache current — while a base-renderer root above it stays silent for
 * changes it cannot see.
 */
export const testRdtDeletedTypeWithOwnRendererFires = () => {
  const { doc, renderer, ynode } = createSuggestionPair(1, 2, false)
  const parB = /** @type {any} */ (ynode.get(0))
  parB.useRenderer(renderer)
  t.assert(parB.delta != null) // materialize the maintained cache
  t.assert(ynode.delta != null) // root cache, maintained under the base renderer
  let parFired = 0
  let parObserved = 0
  let rootFired = 0
  parB.on('delta', () => { parFired++ })
  parB.observe(() => { parObserved++ })
  ynode.on('delta', () => { rootFired++ })
  // delete the paragraph (a visible change on the root; the paragraph itself becomes a tombstone
  // that its own diff renderer still renders)
  ynode.applyDelta(delta.create().delete(1).done())
  t.assert(rootFired === 1, 'root fires for its own visible delete')
  t.assert(parB.delta.equals(parB.toDelta({ deep: true })), 'deleted type cache current after the deletion')
  const parFiredAfterDelete = parFired
  // remote format inside the tombstone: the deleted type fires; the base-renderer root renders
  // nothing and must not emit an empty delta
  doc.get('prosemirror').applyDelta(delta.create().modify(delta.create().retain(1).retain(4, { bold: {} })).done())
  t.assert(parFired === parFiredAfterDelete + 1, 'deleted type with its own renderer fires delta')
  t.assert(parObserved >= 1, 'deleted type with its own renderer fires observe')
  t.assert(rootFired === 1, 'base-renderer root does not emit empty deltas')
  t.assert(parB.delta.equals(parB.toDelta({ deep: true })), 'deleted type cache current after the remote format')
  t.assert(ynode.delta.equals(ynode.toDelta({ deep: true })), 'root cache stays equal to a fresh render')
}

/**
 * Type-scoped UndoManager: tombstone-subtree transactions now reach `changedParentTypes` (the
 * scope check), but origin gating still decides capture — an untracked-origin remote change is
 * not captured.
 */
export const testRdtDeletedSubtreeUndoScope = () => {
  const docP = new Y.Doc({ gc: false })
  docP.clientID = 5
  const docQ = new Y.Doc({ gc: false })
  docQ.clientID = 6
  docP.get('prosemirror').applyDelta(
    delta.create().insert([delta.create('paragraph', {}, 'hello world')]).done()
  )
  Y.applyUpdate(docQ, Y.encodeStateAsUpdate(docP))
  const rootQ = docQ.get('prosemirror')
  const um = new Y.UndoManager(rootQ)
  rootQ.applyDelta(delta.create().delete(1).done()) // local delete → captured
  t.assert(um.undoStack.length === 1)
  // remote change inside the deleted paragraph with an untracked origin: in scope via the
  // deleted-parent bubble, but not captured
  docP.get('prosemirror').applyDelta(delta.create().modify(delta.create().retain(2).insert('XY')).done())
  Y.applyUpdate(docQ, Y.encodeStateAsUpdate(docP), 'remote-origin')
  t.assert(um.undoStack.length === 1, 'untracked-origin remote change is not captured')
}

/**
 * Regression pin (originally a failing repro): an *accepting* (suggestionMode=false) child-node insert with no
 * suggested content anywhere drifts the maintained `.delta` cache. The inserted node reaches the
 * base doc (asserted below — it is committed content, NOT a suggestion, so the
 * "inserted-adjacent-to-suggested-is-suggested" rule does not apply), and a fresh deep render
 * correctly shows no attribution — but the cache keeps the change render's transient
 * `{insert: []}` attribution. Suggestion-mode inserts and accepting inserts adjacent to suggested
 * content are consistent (both sides attributed); only this committed-insert case drifts.
 * Delete-tail + insert-node is the CRDT shape of a ProseMirror block split, so editor workloads
 * hit this constantly.
 */
export const testRdtAcceptingNodeInsertCacheDrift = () => {
  const doc = new Y.Doc({ gc: false })
  const suggestionDoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
  const renderer = Y.createDiffRenderer(doc, suggestionDoc, { attributions: Y.createContentMap() })
  renderer.suggestionMode = false
  doc.get('prosemirror').applyDelta(
    delta.create().insert([delta.create('paragraph', {}, 'base para')]).done()
  )
  const ynode = suggestionDoc.get('prosemirror')
  ynode.useRenderer(renderer)
  t.assert(ynode.delta != null) // materialize the maintained cache
  ynode.applyDelta(delta.create().retain(1).insert([delta.create('paragraph', {}, 'plain')]).done())
  // the insert is committed content: it reached the base doc
  t.assert(JSON.stringify(doc.get('prosemirror').toDeltaDeep().toJSON()).includes('plain'), 'the insert committed to base')
  const cached = ynode.delta
  const fresh = ynode.toDelta({ deep: true })
  t.assert(!JSON.stringify(fresh.toJSON()).includes('"attribution"'), 'fresh render shows committed (unattributed) content')
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render')
  // same class, second entry point: ACCEPTING a suggested node-insert. The suggested insert
  // itself is consistent (both sides attributed), but the accept's de-attribution correction
  // does not descend into the nested node's content — the cache keeps `{insert: []}`.
  {
    const doc2 = new Y.Doc({ gc: false })
    const suggestionDoc2 = new Y.Doc({ isSuggestionDoc: true, gc: false })
    const renderer2 = Y.createDiffRenderer(doc2, suggestionDoc2, { attributions: Y.createContentMap() })
    doc2.get('prosemirror').applyDelta(delta.create().insert([delta.create('paragraph', {}, 'base para')]).done())
    const ynode2 = suggestionDoc2.get('prosemirror')
    ynode2.useRenderer(renderer2)
    t.assert(ynode2.delta != null) // materialize the maintained cache
    renderer2.suggestionMode = true
    ynode2.applyDelta(delta.create().retain(1).insert([delta.create('paragraph', {}, 'sugg')]).done())
    t.assert(ynode2.delta.equals(ynode2.toDelta({ deep: true })), 'suggested insert itself is consistent')
    renderer2.acceptAllChanges()
    t.assert(ynode2.delta.equals(ynode2.toDelta({ deep: true })), 'maintained .delta must equal a fresh render after accepting the node insert')
  }
}

/**
 * Regression pin (originally a failing repro) — the consumer-visible framing of the cache drift above: inserting a
 * node through an *accepting* renderer (`suggestionMode = false`) must not leave it presented as
 * a suggestion. The write currently emits two `'delta'` events: first the insert render, fully
 * attributed (`{insert: []}` on the inserted node AND its nested content), then a de-attribution
 * correction `retain(1).retain(1, {attribution: null})` once the content commits to base — but
 * the correction only clears the attribution on the node itself and never descends into the
 * node's children. Composing the event stream (which is exactly how the maintained `.delta`
 * cache is built) therefore leaves the nested text attributed as a suggested insert forever,
 * while ground truth (a fresh deep render) shows committed, unattributed content. The test does
 * not prescribe the fix: it passes if the insert render arrives unattributed OR if the
 * correction descends — it only requires the settled event stream to converge to the truth.
 */
export const testRdtAcceptingNodeInsertRenderedAsSuggestion = () => {
  const doc = new Y.Doc({ gc: false })
  const suggestionDoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
  const renderer = Y.createDiffRenderer(doc, suggestionDoc, { attributions: Y.createContentMap() })
  renderer.suggestionMode = false
  doc.get('prosemirror').applyDelta(
    delta.create().insert([delta.create('paragraph', {}, 'base para')]).done()
  )
  const ynode = suggestionDoc.get('prosemirror')
  ynode.useRenderer(renderer)
  // composed = pre-write state + every emitted change: what any consumer of the `'delta'`
  // channel (a remote binding, the maintained cache) believes the document looks like
  const composed = delta.cloneDeep(/** @type {any} */ (ynode.toDelta({ deep: true })))
  ynode.on('delta', d => {
    composed.apply(/** @type {any} */ (delta.cloneDeep(/** @type {any} */ (d))), { final: true, move: true })
  })
  ynode.applyDelta(delta.create().retain(1).insert([delta.create('paragraph', {}, 'plain')]).done())
  const fresh = ynode.toDelta({ deep: true })
  t.assert(!JSON.stringify(fresh.toJSON()).includes('"attribution"'), 'ground truth: the insert committed to base, nothing is suggested')
  if (!composed.equals(fresh)) {
    console.error('composed:', JSON.stringify(composed.toJSON()))
    console.error('fresh   :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(!JSON.stringify(composed.toJSON()).includes('"attribution"'), 'the settled event stream must not present the committed insert as a suggestion')
  t.assert(composed.equals(fresh), 'composing the emitted changes converges to a fresh render')
  // deeper nesting must heal at *every* level below the top, not just the first
  ynode.applyDelta(delta.create().retain(2).insert([delta.create('blockquote', {}, [delta.create('paragraph', {}, 'deep')])]).done())
  const fresh2 = ynode.toDelta({ deep: true })
  t.assert(!JSON.stringify(fresh2.toJSON()).includes('"attribution"'), 'ground truth: the multi-level insert committed to base')
  t.assert(!JSON.stringify(composed.toJSON()).includes('"attribution"'), 'no nesting level is left presented as a suggestion')
  t.assert(composed.equals(fresh2), 'the event stream converges for multi-level nesting')
}

/**
 * Guards the id-scoped heal design: unattributing an accepted node must never cascade into a
 * blanket subtree clear, because children may still be attributed. Here only the node's OWN
 * insert struct is committed to base — `acceptChanges` ships an accepted node together with its
 * subtree (see {@link testRdtRangeAcceptShipsNestedStructs}), so the partial state is built by
 * hand through the raw struct path the accept uses — the node commits to base as an empty
 * paragraph while its text children remain pending suggestions. The heal must clear the node's
 * attribution, keep the children's `{insert: []}`, and keep the maintained cache equal to a fresh
 * render.
 */
export const testRdtPartialAcceptKeepsPendingChildSuggestions = () => {
  const doc = new Y.Doc({ gc: false })
  const suggestionDoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
  const renderer = Y.createDiffRenderer(doc, suggestionDoc, { attributions: Y.createContentMap() })
  doc.get('prosemirror').applyDelta(delta.create().insert([delta.create('paragraph', {}, 'base para')]).done())
  const ynode = suggestionDoc.get('prosemirror')
  ynode.useRenderer(renderer)
  t.assert(ynode.delta != null) // materialize the maintained cache
  renderer.suggestionMode = true
  const client = suggestionDoc.clientID
  // suggestion 1: node insert — the paragraph node takes clock 0, its text 'x' clock 1
  ynode.applyDelta(delta.create().retain(1).insert([delta.create('paragraph', {}, 'x')]).done())
  // suggestion 2: more text inside the suggested node
  ynode.applyDelta(delta.create().retain(1).modify(delta.create().retain(1).insert('Q')).done())
  t.assert(ynode.delta.equals(ynode.toDelta({ deep: true })), 'consistent before the partial accept')
  // commit ONLY the node's own struct (clock 0); every child stays a pending suggestion
  const encoder = new Y.UpdateEncoderV1()
  const nodeOnly = Y.createIdSet()
  nodeOnly.add(client, 0, 1)
  writeStructsFromIdSet(encoder, suggestionDoc.store, nodeOnly)
  Y.writeIdSet(encoder, Y.createIdSet())
  Y.applyUpdate(doc, encoder.toUint8Array())
  const cached = ynode.delta
  const fresh = ynode.toDelta({ deep: true })
  const freshJson = /** @type {any} */ (fresh.toJSON())
  // ground truth: the node committed (as an empty paragraph) …
  t.assert(JSON.stringify(doc.get('prosemirror').toDeltaDeep().toJSON()).split('"paragraph"').length === 3, 'the accepted node reached the base doc')
  t.assert(freshJson.children[0].attribution === undefined, 'the accepted node itself is no longer attributed')
  // … while its children are still suggested
  const acceptedPara = freshJson.children[0].insert[1]
  t.assert(acceptedPara.name === 'paragraph' && JSON.stringify(acceptedPara.children).includes('"attribution":{"insert":[]}'), 'pending child suggestions keep their attribution')
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render after the partial accept')
}

/**
 * A range accept ships an accepted node together with its subtree. `collectSuggestedChanges` used
 * to collect only the top-level item chain of the accepted range, so accepting a pending node
 * insert committed the bare node struct: an image reached the base doc without its `src`, a
 * paragraph without its text, a blockquote without its paragraphs (found through y-prosemirror's
 * cohort fuzz — its known issue 7 — where a base-bound editor then threw on the image without its
 * required attr). A nested item can only exist in the suggestion doc if its parent does, so the
 * subtree is part of the same suggestion.
 */
export const testRdtRangeAcceptShipsNestedStructs = () => {
  /**
   * @param {string} label
   * @param {(snode: any) => void} suggest one suggested node insert whose node struct takes clock 0
   * @param {(baseJson: string) => boolean} committed what the base doc's deep render must hold
   */
  const check = (label, suggest, committed) => {
    const base = new Y.Doc({ gc: false })
    base.clientID = 0
    const sugg = new Y.Doc({ isSuggestionDoc: true, gc: false })
    sugg.clientID = 1
    const renderer = Y.createDiffRenderer(base, sugg, { attributions: Y.createContentMap() })
    renderer.suggestionMode = true
    const bnode = base.get('prosemirror')
    const snode = sugg.get('prosemirror')
    bnode.applyDelta(delta.create().insert([delta.create('paragraph', {}, 'ab')]).done())
    snode.useRenderer(renderer)
    t.assert(snode.delta != null) // materialize the maintained cache
    suggest(snode)
    t.assert(JSON.stringify(snode.toDelta({ deep: true }).toJSON()).includes('"attribution":{"insert":[]}'), `${label}: suggested`)
    renderer.acceptChanges(Y.createID(1, 0), Y.createID(1, 0))
    const baseJson = JSON.stringify(bnode.toDeltaDeep().toJSON())
    t.assert(committed(baseJson), `${label}: the accepted node reached the base doc with its subtree (${baseJson})`)
    const fresh = snode.toDelta({ deep: true })
    t.assert(!JSON.stringify(fresh.toJSON()).includes('"attribution"'), `${label}: nothing is left presented as a suggestion`)
    t.assert(snode.delta.equals(fresh), `${label}: maintained .delta equals a fresh deep render after the accept`)
  }
  check(
    'image with a required attr',
    snode => {
      // untyped builders keep tsc's inference shallow here
      const paragraph = /** @type {any} */ (delta.create()).retain(1).insert([delta.create('image', { src: 'x.png' })])
      snode.applyDelta(/** @type {any} */ (delta.create()).modify(paragraph).done())
    },
    json => json.includes('"name":"image"') && json.includes('"src":{"type":"insert","value":"x.png"}')
  )
  check(
    'paragraph with text',
    snode => snode.applyDelta(delta.create().retain(1).insert([delta.create('paragraph', {}, 'text')]).done()),
    json => json.split('"paragraph"').length === 3 && json.includes('"insert":"text"')
  )
  check(
    'blockquote with a nested paragraph',
    snode => snode.applyDelta(delta.create().retain(1).insert([delta.create('blockquote', {}, [delta.create('paragraph', {}, 'deep')])]).done()),
    json => json.includes('"name":"blockquote"') && json.includes('"insert":"deep"')
  )
}

/**
 * Regression pin — fixed by `isRangeEndClear` in the ynode format walk (a rendered unattributed
 * marker closing an attributed same-key range must emit the per-key attribution clear).
 * Minimized from y-prosemirror's `.dbg-fuzz.mjs` seed 54321, op #8; 14/25 fuzz seeds hit this
 * class: a *base-doc* format arrives over an overlapping same-key *suggested* format, then a
 * plain base-doc insert lands inside the formatted range (past the suggested span, with
 * formatted content still following) — the change render emitted for the insert failed to close
 * the attributed-format range, so the maintained `.delta` cache kept a stale
 * `{format: {strong: []}}` on the trailing content while a fresh render showed it committed:
 *
 *   cached: a(strong) | bx({format:{strong:[]}}) | c(strong, {format:{strong:[]}} ← STALE)
 *   fresh : a(strong) | bx({format:{strong:[]}}) | c(strong)
 *
 * The drift appeared alongside the `usedFormats`/`useFormats()` rework (yjs 804e4d34 +
 * lib0 7c1d44e) — it reproduces with the previous lib0 as well, so the yjs-side walk is
 * sufficient to trigger it. It needs the insert strictly *inside* the base-format range and
 * *after* the suggested span; inserting at the suggested span's boundary or at the range end
 * renders correctly.
 */
export const testRdtBaseInsertIntoOverlappingFormatRangeCacheDrift = () => {
  const base = new Y.Doc({ gc: false })
  base.clientID = 0
  const sugg = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sugg.clientID = 1
  const renderer = Y.createDiffRenderer(base, sugg, { attributions: Y.createContentMap() })
  renderer.suggestionMode = true
  const bt = base.get('t')
  const st = sugg.get('t')
  bt.applyDelta(delta.create().insert('abc').done())
  st.useRenderer(renderer)
  t.assert(st.delta != null) // materialize the maintained cache
  // suggested strong on 'a'
  st.applyDelta(delta.create().retain(1, { strong: {} }).done())
  // base strong over all of 'abc' — a base-doc format arriving under an overlapping same-key
  // format suggestion
  bt.applyDelta(delta.create().retain(3, { strong: {} }).done())
  // plain base insert between 'b' and 'c' → the emitted change must end the attributed range,
  // but leaves the trailing 'c' attributed in the cache
  bt.applyDelta(delta.create().retain(2).insert('x').done())
  const cached = st.delta
  const fresh = st.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render after a base insert into the overlapping format range')
}

/**
 * Regression pin — fixed by installing the all-null-leaves context copy in the attribution
 * install gate. Sibling of the class above, found by grid-enumerating the repro skeleton
 * (192 same-class combos in the suggested-insert pass, 496 more with formatted base inserts):
 * with TWO overlapping suggested format keys, the change-render copy of the ambient attributed
 * format context carries per-key null-clear leaves (which fresh contexts never hold), so the
 * emptiness test at the install gate failed where the fresh walk reaches its empty-copy
 * `useAttribution(null)` closure — an unattributed close marker's key deletion was discarded.
 * The stale `{format: {strong: []}}` then surfaced in the cache on the next change render that
 * walks the span: a suggested insert *inside* the em range (an insert past it renders clean):
 *
 *   cached: a(em+strong, both attributed) | x({insert:[]}) | b(…) | cd({format:{strong:[]}} ← STALE)
 *   fresh : a(em+strong, both attributed) | x({insert:[]}) | b(…) | cd
 *
 * The marker integration order is load-bearing: it reproduces with base.clientID > sugg.clientID
 * and renders clean with the order flipped.
 */
export const testRdtSuggestedInsertUnderTwoKeySuggestedFormatsCacheDrift = () => {
  const base = new Y.Doc({ gc: false })
  base.clientID = 1
  const sugg = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sugg.clientID = 0
  const renderer = Y.createDiffRenderer(base, sugg, { attributions: Y.createContentMap() })
  renderer.suggestionMode = true
  const bt = base.get('t')
  const st = sugg.get('t')
  bt.applyDelta(delta.create().insert('abcd').done())
  st.useRenderer(renderer)
  t.assert(st.delta != null) // materialize the maintained cache
  // two overlapping suggested formats → a two-key attributed format context over 'ab'
  st.applyDelta(delta.create().retain(2, { em: {} }).done())
  st.applyDelta(delta.create().retain(4, { strong: {} }).done())
  // base strong over 'ab' — same key/value as the suggestion; the cache is still clean here
  bt.applyDelta(delta.create().retain(2, { strong: {} }).done())
  // suggested insert inside the em range → the change render re-stamps the trailing spans and
  // flushes the stale strong governance into the cache
  st.applyDelta(delta.create().retain(1).insert('x').done())
  const cached = st.delta
  const fresh = st.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render after a suggested insert under a two-key suggested format context')
}

/**
 * Regression pin — fixed by the same install-gate change as the two-key class above (the
 * all-null-leaves context copy must be installed). Formatted-base-insert sibling (grid class B,
 * 496 combos in the formatted-base-insert fuzzing pass): under a two-key
 * suggested format context (em over 'ab', strong over 'a'), a base-doc em arrives on 'a'
 * only — strictly undercovering the suggested em range — so the em governance over the
 * trailing 'b' stays attributed-stale in the cache. A base insert *formatted with the other
 * suggested key* ({strong:{}}) before the context then flushes the stale em into the cache:
 *
 *   cached: x(strong+em, attributed) | a(em, attributed) | b({format:{em:[]}} ← STALE)
 *   fresh : x(strong+em, attributed) | a(em, attributed) | b
 *
 * Every knob is load-bearing: a plain base insert, an em- or third-key-formatted insert,
 * inserting at position 1 or 2, base em covering the full suggested em range, suggested
 * strong covering the full em range, or dropping any of the three format ops all render
 * clean — so this does not collapse into the plain-insert siblings above. Like the sibling,
 * it needs base.clientID > sugg.clientID and renders clean with the order flipped.
 */
export const testRdtFormattedBaseInsertUnderTwoKeySuggestedFormatsCacheDrift = () => {
  const base = new Y.Doc({ gc: false })
  base.clientID = 1
  const sugg = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sugg.clientID = 0
  const renderer = Y.createDiffRenderer(base, sugg, { attributions: Y.createContentMap() })
  renderer.suggestionMode = true
  const bt = base.get('t')
  const st = sugg.get('t')
  bt.applyDelta(delta.create().insert('ab').done())
  st.useRenderer(renderer)
  t.assert(st.delta != null) // materialize the maintained cache
  // two overlapping suggested formats → a two-key attributed format context, em past strong
  st.applyDelta(delta.create().retain(2, { em: {} }).done())
  st.applyDelta(delta.create().retain(1, { strong: {} }).done())
  // base em on 'a' only — same key/value as the suggestion but undercovering its range, so
  // the em governance over the trailing 'b' stays stale; the cache is still clean here
  bt.applyDelta(delta.create().retain(1, { em: {} }).done())
  // base insert formatted with the OTHER suggested key, before the context → the change
  // render re-stamps the trailing spans and flushes the stale em governance into the cache
  bt.applyDelta(delta.create().insert('x', { strong: {} }).done())
  const cached = st.delta
  const fresh = st.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render after a formatted base insert under a two-key suggested format context')
}

/**
 * Regression pin — fixed by the `previousFormats` cache-reference rework in `# Update Formats`
 * (a marker deleted by the change whose value equals the walk's current value dropped out of
 * the tracking, so a later marker was misread as a restore-to-previous and the needed format
 * diff was swallowed). FORMAT-VALUE divergence, minimized from fuzz-core seeds 711 and 4935,
 * which both collapse to this one 4-op skeleton — the two seeds are mirror directions of it,
 * `em:{}` leaking format IN vs `em:null` leaking format OUT:
 * when a base-doc format op's range END lands strictly *inside* a same-key suggested-format
 * span, the change render stamped the base op's format one char PAST its range end. The cache
 * then disagrees with a fresh deep render about the EFFECTIVE FORMAT of that boundary char —
 * not merely its attribution (no attribution differs; none is even present):
 *
 *   cached: abxx(em)                 ← trailing 'x' wrongly formatted
 *   fresh : abx(em) | x(no format)
 *
 * Every ingredient is load-bearing: the pre-existing em on 'b', the TWO appended chars (with a
 * single 'x' there is no boundary char inside the suggested span), the suggestion straddling
 * the base range end (covering only one of the two 'x's renders clean), the base op ending
 * strictly inside the span (retain(4) renders clean), same key on both sides (a `strong`
 * suggestion renders clean), and the order suggestion-before-base-format (flipped renders
 * clean). Reproduces identically with both clientID orders (0/1 and 1/0).
 */
export const testRdtBaseFormatEndingInsideSuggestedFormatRangeFormatValueCacheDrift = () => {
  const base = new Y.Doc({ gc: false })
  base.clientID = 0
  const sugg = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sugg.clientID = 1
  const renderer = Y.createDiffRenderer(base, sugg, { attributions: Y.createContentMap() })
  renderer.suggestionMode = true
  const bt = base.get('t')
  const st = sugg.get('t')
  bt.applyDelta(delta.create().insert('ab').done())
  st.useRenderer(renderer)
  t.assert(st.delta != null) // materialize the maintained cache
  // pre-existing base em on 'b'
  bt.applyDelta(delta.create().retain(1).retain(1, { em: {} }).done())
  // plain base append after the em run
  bt.applyDelta(delta.create().retain(2).insert('xx').done())
  // suggested em over the appended 'xx' — same key as the base format below
  st.applyDelta(delta.create().retain(2).retain(2, { em: {} }).done())
  // base em over 'abx' — the range end lands strictly inside the suggested span; the cache
  // bleeds the em onto the trailing 'x' as its *format* (fresh leaves it unformatted)
  bt.applyDelta(delta.create().retain(3, { em: {} }).done())
  const cached = st.delta
  const fresh = st.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render after a base format ending inside a same-key suggested format range')
}

/**
 * Regression pin — fixed by the open-attributed-range guard on `isDeletedFormatClear`
 * (`previousUnattributedFormats` has the key → the fresh render skips the deleted marker, so
 * the change render must not emit a clear there; mirrors `isAcceptedFormatClear`'s guard).
 * MISSING-attribution class (inverse direction of the stale classes above — there the cache
 * keeps an attribution the fresh render has dropped; here the cache DROPPED one the fresh
 * render keeps). Minimized from fuzz-core seed 2 (drift at opIndex 24, 25 ops → 3):
 * a *suggested format removal* (key → null) of a base-doc format was applied to the maintained
 * cache without the attributed-removal marker that the fresh render produces:
 *
 *   cached: a(em) | b                      ← removal applied, attribution LOST
 *   fresh : a(em) | b({format: {em: []}})  ← attributed suggested removal
 *
 * Load-bearing shape: the base format must extend *beyond* the removed char (em over 'ab',
 * removal on 'b' only — base-formatting 'b' alone renders clean), and the suggestion must
 * first *override* the base format value on that char with a different value ({x:1} vs {};
 * without the override, or with an equal-value override, or with override+removal spanning
 * the whole base range, the removal renders clean). Both clientID orders reproduce; no
 * accept/reject involved (deterministic, 100/100 without seeding Math.random).
 */
export const testRdtSuggestedRemovalOfOverriddenBaseFormatCacheDrift = () => {
  const base = new Y.Doc({ gc: false })
  base.clientID = 0
  const sugg = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sugg.clientID = 1
  const renderer = Y.createDiffRenderer(base, sugg, { attributions: Y.createContentMap() })
  renderer.suggestionMode = true
  const bt = base.get('t')
  const st = sugg.get('t')
  bt.applyDelta(delta.create().insert('ab').done())
  st.useRenderer(renderer)
  t.assert(st.delta != null) // materialize the maintained cache
  // base em over all of 'ab' — must extend beyond the char the suggestion touches
  bt.applyDelta(delta.create().retain(2, { em: {} }).done())
  // suggested override of the base format value on 'b' (different value is load-bearing)
  st.applyDelta(delta.create().retain(1).retain(1, { em: { x: 1 } }).done())
  // suggested removal of em on 'b' → cache applies the removal but loses the attribution
  st.applyDelta(delta.create().retain(1).retain(1, { em: null }).done())
  const cached = st.delta
  const fresh = st.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render after a suggested removal of an overridden base format')
}

/**
 * Regression pin — fixed by the same open-attributed-range guard on `isDeletedFormatClear` as
 * the class above. Adjudicated core of lifecycle-fuzz class P5 ("post-clearCache re-drift",
 * seeds 657/1131/2401): clearCache is NOT load-bearing — all three seeds drift identically with
 * the clearCache op deleted, and a FRESH doc/renderer pair built via
 * encodeStateAsUpdate/applyUpdate to the pre-clearCache state drifts identically on the same
 * final op. The class collapses into the core no-lifecycle overlapping same-key format drift
 * family (missing-attribution direction): a suggested unformat of a base-doc format, staged
 * left-to-right in two steps, lost the second step's unformat attribution in the maintained
 * cache:
 *
 *   cached: a({format:{em:[]}}) | b(no attribution ← MISSING)
 *   fresh : ab({format:{em:[]}})
 *
 * Load-bearing: the two-step left-to-right staging (a single merged retain(2,{em:null}) renders
 * clean, and unformatting 'b' before 'a' renders clean) and the base format arriving as ONE op
 * over both chars (two 1-char base formats + a merged suggested unformat renders clean).
 * Key (em/strong), base format value ({} vs {x:1}) and the clientID order are NOT load-bearing
 * (drifts identically with base=0/sugg=1 and base=1/sugg=0). With a 3-char doc the same ops
 * additionally leave a STALE {format:{em:[]}} on the still-formatted trailing char, i.e. both
 * catalogued drift directions come from this walk defect.
 */
export const testRdtStagedSuggestedUnformatOfBaseFormatCacheDrift = () => {
  const base = new Y.Doc({ gc: false })
  base.clientID = 0
  const sugg = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sugg.clientID = 1
  const renderer = Y.createDiffRenderer(base, sugg, { attributions: Y.createContentMap() })
  renderer.suggestionMode = true
  const bt = base.get('t')
  const st = sugg.get('t')
  bt.applyDelta(delta.create().insert('ab').done())
  st.useRenderer(renderer)
  t.assert(st.delta != null) // materialize the maintained cache
  // base em over all of 'ab' — in suggestion mode a base-doc format is not itself a suggestion
  bt.applyDelta(delta.create().retain(2, { em: {} }).done())
  // suggested unformat of the same key, staged left-to-right: first 'a' — the cache is still
  // clean here, 'a' carries {format:{em:[]}}
  st.applyDelta(delta.create().retain(1, { em: null }).done())
  // ... then 'b' — the second step drops the {format:{em:[]}} attribution for 'b' from the
  // cache while the fresh render keeps it
  st.applyDelta(delta.create().retain(1).retain(1, { em: null }).done())
  const cached = st.delta
  const fresh = st.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render after a staged suggested unformat of a base format')
}

/**
 * Regression pin — fixed by provenance tracking (`currentFormatsAttributed`) widening
 * `isDeletedFormatClear` to committed enclosing values: the accept deletes the committed run's
 * close marker, whose removal re-exposes the committed `strong={}`, and the old
 * `currFormatVal == null` guard blocked the needed clear. (Lifecycle-fuzz class P2, 23/3000
 * seeds; minimized from seed 259's 9 ops to 3): ACCEPT-triggered cache drift — every step
 * before the accept is consistent, and `acceptAllChanges()` itself corrupted the maintained
 * `.delta`. Shape: a committed `strong` run
 * ('a', present since the very first render) with a plain char ('b') right after it; a suggested
 * `strong` on 'b' with the SAME key AND the SAME value as the committed run; accept-all. The
 * accept commits the suggestion to base, and a fresh deep render shows one fully-committed
 * unattributed run — but the accept's change render never clears the suggestion's format
 * attribution on 'b', leaving the stale `{format:{strong:[]}}` in the cache forever:
 *
 *   cached: a(strong) | b(strong, {format:{strong:[]}} ← STALE)
 *   fresh : ab(strong)
 *
 * Everything is load-bearing: same key (strong/em → clean), same value ({} vs {x:1} or null →
 * clean), adjacency (a gap between the runs → clean), and order (committed run must precede the
 * suggested char; suggesting on the char *before* the run, or on the run itself, renders clean).
 * Both clientID orders reproduce. Related but distinct from
 * testRdtAcceptingNodeInsertCacheDrift (that class leaks `{insert:[]}` into nested node content;
 * this one leaks a `format` attribution on plain text, with a clean pre-accept state).
 */
export const testRdtAcceptAllOfSameValueSuggestedFormatCacheDrift = () => {
  const base = new Y.Doc({ gc: false })
  base.clientID = 0
  const sugg = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sugg.clientID = 1
  const renderer = Y.createDiffRenderer(base, sugg, { attributions: Y.createContentMap() })
  renderer.suggestionMode = true
  const bt = base.get('t')
  const st = sugg.get('t')
  // committed strong on 'a', plain 'b' — present since the very first render
  bt.applyDelta(delta.create().insert('a', { strong: {} }).insert('b').done())
  st.useRenderer(renderer)
  t.assert(st.delta != null) // materialize the maintained cache
  // suggested strong on the adjacent 'b' — same key AND same value as the committed run
  st.applyDelta(delta.create().retain(1).retain(1, { strong: {} }).done())
  // the suggestion itself renders consistently; the drift is accept-triggered
  t.assert(st.delta.equals(st.toDelta({ deep: true })), 'suggested format itself is consistent')
  renderer.acceptAllChanges()
  const cached = st.delta
  const fresh = st.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render after accepting a same-value suggested format extension')
}

/**
 * Regression pin — the long-documented reject-side provenance residual, fixed by the same
 * `currentFormatsAttributed` provenance tracking as the accept class above (the failing render
 * is the sugg-doc EVENT render — the reject's heal render receives an empty change set — and
 * the deleted suggestion marker re-exposes the enclosing *committed* base strong, which the old
 * `currFormatVal == null` guard could not see). Lifecycle-fuzzing class P1, 45 seeds; minimized
 * from the 9-op seed-132 representative to 4 ops: a suggested strong on 'a' under a base strong
 * over all of 'ab' — same key, with the base range extending strictly *past* the suggested
 * span — then rejectAllChanges. The reject clears the suggestion, but the change render left
 * the trailing 'b' still carrying the suggested-format attribution in the cache; the fresh
 * render shows it unattributed:
 *
 *   cached: a(strong) | b(strong, {format:{strong:[]}} ← STALE)
 *   fresh : ab(strong)
 *
 * Everything here is load-bearing: without the suggested format, without the base format, with
 * a different suggested key (em), with the base range ending where the suggested span ends
 * (full overlap), or with the sugg span at the end of the base range, it renders clean. The
 * pre-reject cache is consistent — the residual appears only at the reject. The marker
 * integration order is load-bearing in the opposite direction of the two-key siblings above:
 * it reproduces with base.clientID < sugg.clientID and renders clean flipped. The reject flow
 * does not echo structs back here (both clientIDs survive unreassigned), so the repro is
 * Math.random-free: 100/100 identical failing runs without seeding.
 */
export const testRdtRejectAllOverlappingSameKeyFormatProvenanceResidual = () => {
  const base = new Y.Doc({ gc: false })
  base.clientID = 0
  const sugg = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sugg.clientID = 1
  const renderer = Y.createDiffRenderer(base, sugg, { attributions: Y.createContentMap() })
  renderer.suggestionMode = true
  const bt = base.get('t')
  const st = sugg.get('t')
  bt.applyDelta(delta.create().insert('ab').done())
  st.useRenderer(renderer)
  t.assert(st.delta != null) // materialize the maintained cache
  // suggested strong on 'a'
  st.applyDelta(delta.create().retain(1, { strong: {} }).done())
  // base strong over all of 'ab' — same key, extending strictly past the suggested span
  bt.applyDelta(delta.create().retain(2, { strong: {} }).done())
  t.assert(st.delta.equals(st.toDelta({ deep: true })), 'consistent before the reject')
  // reject the suggestion → the trailing 'b' keeps the stale suggested-format attribution
  renderer.rejectAllChanges()
  const cached = st.delta
  const fresh = st.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render after rejecting overlapping same-key formats')
}

/**
 * Regression pin — fixed by re-adding the reset key as an explicit clear when the ambient-copy
 * install is forced by the all-null-leaves disjunct (installing after silently dropping the key
 * would close its governance without the clear the fresh render's context-close implies):
 * partial-accept cache drift when the accepted id range SPLITS a suggested format's
 * open/close ContentFormat marker pair. Lifecycle-fuzz seed 648 (failIndex 14, 15 ops incl. an
 * accept and a reject) minimized to 5 ops with no inserts/deletes at all.
 *
 * Shape: two different-key suggested formats on the same char 'A' of base text 'AB'. The sugg
 * client's structs are exactly four ContentFormat markers — clock 0 = em open ({em:{}}),
 * clock 1 = em close ({em:null}), clock 2 = strong open, clock 3 = strong close.
 * `acceptChanges(createID(1,1), createID(1,1))` accepts ONLY the em CLOSE marker (clock 1),
 * splitting the em pair. The accept itself still renders consistently — the residual is armed,
 * not visible. The next suggested unformat of 'A' then corrupts the maintained cache: the
 * incremental render lets the strong suggestion's format attribution run past its close marker
 * onto the trailing 'B':
 *
 *   cached: A(strong, {format:{strong:[]}}) | B({format:{strong:[]}} <- STALE)
 *   fresh : A(strong, {format:{strong:[]}}) | B
 *
 * Load-bearing (each verified): the accept range must contain the em close marker and NOT the
 * em open marker (1-1, 1-2, 1-3 all drift; 0-0, 0-1 whole-pair, 2-2, 3-3 all clean) — the
 * marker-pair split IS the trigger; a second suggested format with a different key and non-null
 * value (same key em -> clean, strong:null -> clean); a trailing char after the formatted one
 * (init 'A' alone -> clean, formatting the last char -> clean); the final op must be an
 * unformat — em:{} reformat is clean, while em:null and strong:null both drift identically.
 * Every step before the final unformat is consistent, including the accept. Both clientID
 * orders fail byte-identically; the accept does not echo structs back (no Math.random clientID
 * reassignment), so the repro is seed-free: 100/100 identical failing runs. Same stale-
 * {format:{strong:[]}}-on-trailing-char symptom as the (fixed)
 * testRdtRejectAllOverlappingSameKeyFormatProvenanceResidual pin, but a distinct class: no base
 * format involved, the trigger is a marker-splitting PARTIAL accept, and the drift is deferred
 * to a later unformat.
 */
export const testRdtSplitFormatMarkerPairPartialAcceptThenUnformatCacheDrift = () => {
  const base = new Y.Doc({ gc: false })
  base.clientID = 0
  const sugg = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sugg.clientID = 1
  const renderer = Y.createDiffRenderer(base, sugg, { attributions: Y.createContentMap() })
  renderer.suggestionMode = true
  const bt = base.get('t')
  const st = sugg.get('t')
  bt.applyDelta(delta.create().insert('AB').done())
  st.useRenderer(renderer)
  t.assert(st.delta != null) // materialize the maintained cache
  // two different-key suggested formats on 'A' — sugg structs: clock 0/1 = em open/close,
  // clock 2/3 = strong open/close
  st.applyDelta(delta.create().retain(1, { em: {} }).done())
  st.applyDelta(delta.create().retain(1, { strong: {} }).done())
  // accept ONLY the em close marker (clock 1), splitting the em marker pair — the accept
  // itself still renders consistently
  renderer.acceptChanges(Y.createID(1, 1), Y.createID(1, 1))
  t.assert(st.delta.equals(st.toDelta({ deep: true })), 'consistent immediately after the marker-splitting accept')
  // suggested unformat of 'A' → the cache leaks {format:{strong:[]}} onto the trailing 'B'
  st.applyDelta(delta.create().retain(1, { em: null }).done())
  const cached = st.delta
  const fresh = st.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render after unformatting under a split-accepted format marker pair')
}

/**
 * Regression pin — fixed by the same reset-branch clear re-add as the split-marker-pair class
 * above (both are the marker-pair-splitting-accept walk shape). Minimized from lifecycle-fuzz
 * seed 1034 (failIndex 15, 16 ops → 6):
 * PARTIAL-ACCEPT-triggered LATENT cache drift, stale-attribution direction. A committed base
 * `strong` over 'abc'; a suggested unformat (strong → null) of 'b' (sugg-client markers:
 * clock 0 = open strong:null, clock 1 = close/restore strong:{}); a second suggested format
 * with a DIFFERENT key (em:{}) on the same 'b' (clocks 2/3); then a partial
 * `acceptChanges(id(1,1), id(1,1))` that accepts ONLY the unformat's range-END restore marker,
 * skipping its open marker at clock 0. The accept itself still renders consistently — the
 * corruption is latent — but the next suggested format edit over the region (removing the em)
 * re-renders 'c' with a stale `{format:{strong:[]}}` the fresh deep render does not have:
 *
 *   cached: a(strong) | b({format:{strong:[]}}) | c(strong, {format:{strong:[]}} ← STALE)
 *   fresh : a(strong) | b({format:{strong:[]}}) | c(strong)
 *
 * Load-bearing: the accept range must EXCLUDE clock 0 and include at least one later sugg
 * marker — accept(1,1), accept(2,2) and accept(3,3) all drift identically, while accept(0,0),
 * accept(0,3), acceptAll and reject(1,1) render clean; the second suggested format must exist
 * BEFORE the accept and use a different key (dropping it, or using strong for both, renders
 * clean — which op carries which key does not matter, swapped keys drift too); the final op
 * must be a format CHANGE re-rendering the region (em:null on 'b' or 'c', or a base em:{} on
 * 'b' — re-applying the same em:{}, inserts, deletes and clearCache all render clean); and the
 * committed strong must extend both strictly before and strictly past 'b' (2-char docs 'ab'/'bc'
 * and base ranges not covering 'a' or 'c' render clean). Both clientID orders drift identically;
 * the accept does not echo structs back (clientIDs survive unreassigned), so the repro is
 * Math.random-free: 100/100 identical failing runs without seeding, on both trees. Related to
 * (but distinct from) the fixed testRdtAcceptAllOfSameValueSuggestedFormatCacheDrift: here
 * acceptAll is CLEAN, the partial id range is essential, and the drift needs a second op after
 * the accept.
 */
export const testRdtPartialAcceptSkippingUnformatOpenMarkerCacheDrift = () => {
  const base = new Y.Doc({ gc: false })
  base.clientID = 0
  const sugg = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sugg.clientID = 1
  const renderer = Y.createDiffRenderer(base, sugg, { attributions: Y.createContentMap() })
  renderer.suggestionMode = true
  const bt = base.get('t')
  const st = sugg.get('t')
  bt.applyDelta(delta.create().insert('abc').done())
  st.useRenderer(renderer)
  t.assert(st.delta != null) // materialize the maintained cache
  // committed base strong over all of 'abc' — must extend both before and past 'b'
  bt.applyDelta(delta.create().retain(3, { strong: {} }).done())
  // suggested unformat of the base strong on 'b' → sugg-client markers
  // clock 0 (open, strong:null) and clock 1 (close/restore, strong:{})
  st.applyDelta(delta.create().retain(1).retain(1, { strong: null }).done())
  // second suggested format (different key) on the same 'b' → clocks 2 (em:{}) and 3 (em:null)
  st.applyDelta(delta.create().retain(1).retain(1, { em: {} }).done())
  t.assert(st.delta.equals(st.toDelta({ deep: true })), 'consistent before the accept')
  // PARTIAL accept of only clock 1 — the unformat's range-END restore marker — skipping the
  // open marker at clock 0. The accept itself still renders consistently (latent corruption).
  renderer.acceptChanges(Y.createID(1, 1), Y.createID(1, 1))
  t.assert(st.delta.equals(st.toDelta({ deep: true })), 'consistent after the partial accept')
  // suggested removal of the em → the re-render leaves a stale {format:{strong:[]}} on 'c'
  st.applyDelta(delta.create().retain(1).retain(1, { em: null }).done())
  const cached = st.delta
  const fresh = st.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render after a format edit following a partial accept that skipped the unformat open marker')
}

/**
 * Regression pin — fixed by threading `fresh` onto fresh-format pieces (mode-0 retained path)
 * so a fresh reset-to-previous marker emits the per-key attribution clear like a rendered
 * marker. The removeMark class from y-prosemirror cohort-fuzz seeds 143
 * (drift at op #35), 2 (op #46) and 18 (op #63), which all collapse to this one 3-op
 * skeleton (cross-checked: each seed's failing op is a no-suggestions user's removeMark,
 * i.e. a BASE-doc unformat, over text inside a suggested-block-deleted paragraph, and each
 * seed's drift is the same stale format-attribution shape). STALE-attribution class in the
 * nested deleted-children render path: a base-doc partial unformat (strong: null) of a base
 * format on text inside a paragraph that is block-deleted as a suggestion never lands in the
 * maintained cache — the cached delta after the op is byte-identical to the pre-op state,
 * while the fresh deep render drops the format attribution on the covered chars:
 *
 *   cached: paragraph[ ab({format:{strong:[]},delete:[]}) ]   ← stale strong:[] on 'b'
 *   fresh : paragraph[ a({format:{strong:[]},delete:[]}) | b({delete:[]}) ]
 *
 * Load-bearing: the suggested BLOCK delete of the paragraph embed (a flat-YText suggested
 * delete renders clean, and a text-level delete inside the paragraph renders clean), the
 * base-side provenance of format+unformat (a sugg-side format/unformat pair inside the
 * deleted paragraph renders clean), the unformat being a REMOVAL (re-formatting 'b' to a
 * different value {x:1} renders clean; a partial format with no prior format renders clean),
 * and the partial unformat clearing the TRAILING part of the formatted run (a full-range
 * unformat renders clean, unformatting only the leading 'a' renders clean, and a 1-char
 * format with the unformat extending past its end renders clean — hence the two chars).
 * NOT load-bearing: the format key (em drifts identically), the order of the block delete
 * vs the base format (format-before-delete drifts identically), and the clientID order
 * (both 0/1 and 1/0 drift identically). No accept/reject is involved, so no Math.random
 * clientID reassignment can occur: 100/100 byte-identical failing runs without seeding.
 * Fails identically on the unpatched baseline — a pre-existing class, disjoint from the
 * seven flat-text pins above (this one needs the deleted-ContentType modify render path;
 * likely the known "modify targeting a tombstoned child is skipped by the incremental
 * change render" defect).
 */
export const testRdtBaseUnformatInsideBlockDeletedParagraphCacheDrift = () => {
  const base = new Y.Doc({ gc: false })
  base.clientID = 0
  const sugg = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sugg.clientID = 1
  const renderer = Y.createDiffRenderer(base, sugg, { attributions: Y.createContentMap() })
  renderer.suggestionMode = true
  const bt = base.get('t')
  const st = sugg.get('t')
  bt.applyDelta(delta.create().insert([delta.create('paragraph', {}, 'ab')]).done())
  st.useRenderer(renderer)
  t.assert(st.delta != null) // materialize the maintained cache
  // suggested block delete of the whole paragraph
  st.applyDelta(delta.create().delete(1).done())
  // base strong over both chars inside the (suggested-deleted) paragraph — renders as an
  // attributed format on the deleted text; still consistent here
  bt.applyDelta(delta.create().modify(delta.create('paragraph').retain(2, { strong: {} }).done()).done())
  t.assert(st.delta.equals(st.toDelta({ deep: true })), 'consistent before the unformat')
  // base unformat of the TRAILING char only — fresh drops the strong:[] attribution on 'b',
  // the maintained cache keeps it on all of 'ab' (the change never lands in the cache)
  bt.applyDelta(delta.create().modify(delta.create('paragraph').retain(1).retain(1, { strong: null }).done()).done())
  const cached = st.delta
  const fresh = st.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render after a base partial unformat inside a block-deleted paragraph')
}

/**
 * Regression pin — fixed by the same fresh-format `c.fresh` threading as the class above.
 * Minimized from y-prosemirror fuzz seed 103 (cache
 * drift at op #68: a no-suggestions user's deleteRange whose PM diff carried a `{em:null}`
 * format clear into the base doc, `retain(2).delete(2).insert('tl',{strong}).retain(1,{em:null})
 * .delete(4)` inside a modify). The 6-user cohort, the ProseMirror layer and the 68-op history
 * are NOT load-bearing — fresh docs + a fresh renderer rebuilt from the pre-op state snapshot
 * drift identically, and the class reduces to 2 ops on a 1-paragraph doc:
 * a base-doc format CLEAR (key → null) ending strictly *inside* the same-key base format run,
 * applied INSIDE a suggestion-deleted paragraph (a whole-node tombstone, still rendered
 * delete-attributed), never reaches the maintained cache. The change render re-stamps the
 * ambient `{format:{em:[]}}` attribution over the run instead of emitting the clear (and fires
 * 'delta' twice for the one base transaction); a fresh deep render is correct:
 *
 *   cached: ab({format:{em:[]}, delete:[]})                               ← clear LOST
 *   fresh : a({format:{em:[]}, delete:[]}) | b({delete:[]})
 *
 * Load-bearing shape: the WHOLE-NODE suggestion-delete (a text-level suggestion-delete of the
 * same chars renders clean, as does every flat-text variant), the format CLEAR direction (a
 * format add inside the tombstone renders clean — the green
 * testRdtDeltaFormatThroughDeletedParent contract), and the run extending before the cleared
 * char (em on 'b' alone, clearing the leading char, or a whole-run single-char clear all render
 * clean; clearing a middle char of 'abc' drifts too). Key (em/strong) and format value ({} vs
 * true) are not load-bearing. Both clientID orders drift identically (100/100 unseeded, no
 * accept/reject involved).
 */
export const testRdtBaseFormatClearInsideSuggestionDeletedParagraphCacheDrift = () => {
  const base = new Y.Doc({ gc: false })
  base.clientID = 0
  const sugg = new Y.Doc({ isSuggestionDoc: true, gc: false })
  sugg.clientID = 1
  const renderer = Y.createDiffRenderer(base, sugg, { attributions: Y.createContentMap() })
  renderer.suggestionMode = true
  const bt = base.get('t')
  const st = sugg.get('t')
  // base paragraph with an em run over 'ab'
  bt.applyDelta(delta.create().insert([delta.create('paragraph').insert('ab', { em: {} })]).done())
  st.useRenderer(renderer)
  t.assert(st.delta != null) // materialize the maintained cache
  // suggestion-delete the whole paragraph (stays rendered as an attributed tombstone)
  st.applyDelta(delta.create().delete(1).done())
  t.assert(st.delta.equals(st.toDelta({ deep: true })), 'cache consistent after the suggestion delete')
  // base clears em on 'b' only — a clear ending strictly inside the em run, inside the tombstone
  bt.applyDelta(delta.create().modify(delta.create().retain(1).retain(1, { em: null })).done())
  const cached = st.delta
  const fresh = st.toDelta({ deep: true })
  if (!cached.equals(fresh)) {
    console.error('cached:', JSON.stringify(cached.toJSON()))
    console.error('fresh :', JSON.stringify(fresh.toJSON()))
  }
  t.assert(cached.equals(fresh), 'maintained .delta must equal a fresh deep render after a base format clear inside a suggestion-deleted paragraph')
}

/**
 * Fingerprint-memo pin for the SECOND in-place cache-patch site: the renderer-overlay path
 * (`typeApplyRendererChange` in src/ynode.js) — patches the maintained `.delta` via `apply` on a
 * renderer 'change' event, WITHOUT a Y transaction on this doc (the fuzz pins only cover the
 * per-transaction path). Fingerprints are memoized on the live cache before each step, exactly
 * like a y-sync consumer; every overlay patch must invalidate them. Text-only ops on purpose
 * (accept flows around nested node inserts have separately pinned structural quirks — see e.g.
 * testRdtAcceptAllOfSameValueSuggestedFormatCacheDrift — that would contaminate this memo pin).
 */
export const testRdtFingerprintMemoOverlayCacheDrift = () => {
  const doc = new Y.Doc({ gc: false })
  const suggestionDoc = new Y.Doc({ isSuggestionDoc: true, gc: false })
  const renderer = Y.createDiffRenderer(doc, suggestionDoc, { attributions: Y.createContentMap() })
  doc.get('root').applyDelta(delta.create().insert('base content').done())
  const ynode = suggestionDoc.get('root')
  ynode.useRenderer(renderer)
  t.assert(ynode.delta.fingerprint != null) // materialize the cache AND memoize (the y-sync consumer step)
  renderer.suggestionMode = true
  ynode.applyDelta(delta.create().retain(2).delete(3).done()) // suggestion delete
  assertDeltaCacheFresh(ynode, 'after suggestion delete')
  ynode.format(0, 2, { bold: true }) // suggested format
  assertDeltaCacheFresh(ynode, 'after suggested format')
  // accept fires 'change' -> typeApplyRendererChange -> in-place apply on the memoized cache
  renderer.acceptAllChanges()
  assertDeltaCacheFresh(ynode, 'after acceptAllChanges (renderer overlay patch)')
}

/**
 *
 *
 * @param {t.TestCase} _tc
 */
export const testAttributionRendererActiveChangesInDiff = _tc => {
  const ydoc = new Y.Doc({ gc: false })
  const ytext = ydoc.get()
  ytext.insert(0, 'hella')
  const state1 = Y.createContentIdsFromDoc(ydoc, true)
  ytext.applyDelta(delta.create().retain(4).delete(1).insert('o!').done())
  const state2 = Y.createContentIdsFromDoc(ydoc, true)
  ytext.applyDelta(delta.create().retain(5).delete(1).insert(' world').done())
  // state3 captures the *visible* content (`insertsContainDeletes: false` → inserts already exclude
  // deletes). Using it both as the intersection target and as `renderedContent` means: a change that
  // was inserted-then-deleted by state3 (the '!' at clock 6) is no longer an active insert and drops
  // out, and state3's deletions (the 'a' at clock 4) aren't "restored" so they keep their delete
  // attribution instead of re-rendering as inserts.
  const state3 = Y.createContentIdsFromDoc(ydoc, false)
  ytext.applyDelta(delta.create().delete(11).insert('42').done())

  // render the active changes that happened between state 1 and 2 within state 3.
  const attrs = Y.createContentMapFromContentIds(Y.intersectContentIds(Y.excludeContentIds(state2, state1), state3), [], [])
  const renderer = Y.createAttributionsRenderer(attrs, { renderedContent: state3.inserts })

  const attrDelta = ytext.toDelta({ renderer })
  console.log(attrDelta.toJSON())
  t.compare(attrDelta, delta.create().insert('hell').insert('a', null, { delete: [] }).insert('o', null, { insert: [] }).insert(' world').done())
}
