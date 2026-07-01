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
  ytext.applyDelta(delta.create().retain(11).insert('!').done(), { renderer })
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
  ytext.applyDelta(delta.create().retain(11).insert('content').done(), { renderer })
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
  ytext.applyDelta(delta.create().retain(9).insert('l').done(), { renderer })
  t.assert(ytext.toString() === 'hello world')
}

export const testYdocDiff = () => {
  const ydocStart = new Y.Doc()
  ydocStart.get('text').insert(0, 'hello')
  ydocStart.get('array').insert(0, [1, 2, 3])
  ydocStart.get('map').setAttr('k', 42)
  ydocStart.get('map').setAttr('nested', new Y.Type())
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
  const yf = new Y.Type('test')
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
  const globalAttributions = new Y.Attributions()
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
  const d1 = text0.toDelta({ renderer: Y.createDiffRenderer(v1, users[0], { attrs: globalAttributions }) })
  t.compare(d1, delta.create().insert('a', null, { insert: ['0'] }).insert('b', null, { insert: ['1'] }).done())
  const v2 = Y.cloneDoc(users[0])
  text0.delete(1, 1)
  text1.insert(2, 'c')
  testConnector.flushAllMessages()
  const d2 = text0.toDelta({ renderer: Y.createDiffRenderer(v2, users[0], { attrs: globalAttributions }) })
  t.compare(d2, delta.create().insert('a').insert('b', null, { delete: ['0'] }).insert('c', null, { insert: ['1'] }).done())

  const onlyUser0ChangesAttributed = {
    inserts: Y.filterIdMap(globalAttributions.inserts, attrs => attrs.some(attr => attr.name === 'insert' && attr.val === '0')),
    deletes: Y.filterIdMap(globalAttributions.deletes, attrs => attrs.some(attr => attr.name === 'delete' && attr.val === '0'))
  }
  const rendererUser0 = new Y.TwosetRenderer(onlyUser0ChangesAttributed.inserts, onlyUser0ChangesAttributed.deletes)
  const d3 = text0.toDelta({ renderer: rendererUser0 })
  t.compare(d3, delta.create().insert('a', null, { insert: ['0'] }).insert('b', null, { delete: ['0'] }).insert('c').done())
  Y.undoContentIds(users[0], Y.createContentIdsFromContentMap(onlyUser0ChangesAttributed))

  const d4 = text0.toDelta()
  t.compare(d4, delta.create().insert('bc').done())
}

export const testAttributionEvent = () => {
  const ydoc = new Y.Doc()
  const ytype = ydoc.get()
  // <p>hi</p>
  ytype.applyDelta(delta.create().insert([delta.create('p').insert('hi').done()]).done())
  const ydocBase = Y.cloneDoc(ydoc)
  const renderer = Y.createDiffRenderer(ydocBase, ydoc)
  let called = false
  ytype.observeDeep(event => {
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
  ytype.delete(0, 1)
  t.assert(called)
}

export const testAttributionChange = () => {
  const ydoc = new Y.Doc()
  const ytype = ydoc.get()
  ytype.applyDelta(delta.create().insert('hi').done())
  const ydocClone = Y.cloneDoc(ydoc)
  const renderer = Y.createDiffRenderer(ydocClone, ydoc)
  ytype.applyDelta(delta.create().retain(2).insert('!').done())
  let calledHandler = false
  renderer.on('change', changes => {
    calledHandler = true
    const changeUpdate = ytype.toDelta({ renderer, deep: true, itemsToRender: changes, retainInserts: true, retainDeletes: true })
    // the '!' lost its `{ insert: [] }` suggestion attribution → the change clears it (tri-state `null`)
    const expectedUpdate = delta.create().retain(2).retain(1, undefined, null)
    t.compare(changeUpdate, expectedUpdate)
  })
  Y.applyUpdate(ydocClone, Y.encodeStateAsUpdate(ydoc))
  t.assert(calledHandler)
}

/**
 * A YType implements the lib0 `RDT` interface, so two types can be kept in sync with `bind`.
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
  const child = new Y.Type()
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
  const child = new Y.Type()
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
 * `YType` conforms to the lib0 `RDT` interface — verified at runtime with `$rdt.check` (replaces the
 * old compile-time `_assertYTypeIsRdt`).
 */
export const testRdtConformsToRdtSchema = () => {
  t.assert($rdt.check(new Y.Doc().get()))
  t.assert($rdt.check(new Y.Type()))
  t.assert(!$rdt.check({}))
  t.assert(!$rdt.check(null))
}

/**
 * Collect a type and all of its (non-deleted) nested `YType` descendants.
 *
 * @param {Y.Type<any>} root
 * @return {Array<Y.Type<any>>}
 */
const collectTypes = root => {
  /**
   * @type {Array<Y.Type<any>>}
   */
  const out = [root]
  for (let i = 0; i < out.length; i++) {
    out[i].forEach(c => { if (c instanceof Y.Type) out.push(c) })
    out[i].forEachAttr(v => { if (v instanceof Y.Type) out.push(v) })
  }
  return out
}

/**
 * Apply one random mutation to a random type in the tree rooted at `root`.
 *
 * @param {prng.PRNG} gen
 * @param {Y.Type<any>} root
 */
const applyRandomYTypeOp = (gen, root) => {
  const target = prng.oneOf(gen, collectTypes(root))
  switch (prng.int32(gen, 0, 4)) {
    case 0: // insert text
      target.insert(prng.int32(gen, 0, target.length), prng.word(gen))
      break
    case 1: // insert a nested type
      target.insert(prng.int32(gen, 0, target.length), [new Y.Type()])
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
 * Fuzz: after each random mutation, every type's maintained `delta` cache (at every nesting level)
 * must equal a fresh deep render `toDelta({ deep: true })`.
 *
 * @param {t.TestCase} tc
 */
export const testRdtDeltaFuzz = tc => {
  const ydoc = new Y.Doc()
  const root = ydoc.get('root')
  for (let i = 0; i < 300; i++) {
    applyRandomYTypeOp(tc.prng, root)
    collectTypes(root).forEach(type =>
      t.assert(type.delta.equals(type.toDelta({ deep: true })), `iter ${i}`))
  }
}

/**
 * Fuzz under a diffing renderer, across two synced replicas. Each replica is a "suggestion doc" that
 * diffs against its own fixed baseline clone (taken after some shared initial content). With the plain
 * diff renderer (no `attrs`), suggestion inserts render `{ insert: [] }` and deletes render
 * `{ delete: [] }` — identical on every replica — so the maintained, diff-attributed `delta` must
 * converge across replicas (and match a fresh deep render). The cache is kept current purely by the
 * `'delta'` event (no recompute).
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
    applyRandomYTypeOp(tc.prng, prng.oneOf(tc.prng, users).get('root')) // includes format add/remove
    testConnector.flushAllMessages()
    const a = d0.get('root').delta
    const b = d1.get('root').delta
    t.assert(a.equals(b), `converge iter ${i}`) // the suggestion view is replica-independent
    t.assert(a.equals(d0.get('root').toDelta({ deep: true })), `canonical iter ${i}`) // and matches a fresh render
  }
}

/**
 * Regression (deterministic, seed 1): removing a format under a diffing renderer must keep the
 * incrementally-maintained `.delta` equal to a fresh `toDelta({ deep: true })`. The bug was in the
 * `ContentFormat` change-mode block of `toDelta` (src/ytype.js): un-formatting cleared the format
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
    applyRandomYTypeOp(gen, prng.oneOf(gen, docs).get('root'))
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
  void root.delta // first access starts maintaining the incremental cache
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
 * Regression (was a known bug — minimal, deterministic, no prng): inserting an embed (nested `Y.Type`)
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
  void root.delta // first access starts maintaining the incremental cache
  root.format(0, 2, { bold: true }) // bold "ab"
  root.insert(1, [new Y.Type()]) // insert an embed inside the bold run: "a<T>b"
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
  void root.delta // start maintaining the incremental cache
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
  const child = new Y.Type()
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
  const attrs = new Y.Attributions()
  ydoc.on('update', (update, _origin, doc, tr) => {
    if (!tr.local) return
    const uid = doc.clientID.toString()
    const cids = Y.createContentIdsFromUpdate(update)
    Y.insertIntoIdMap(attrs.inserts, Y.createIdMapFromIdSet(cids.inserts, [Y.createContentAttribute('insert', uid)]))
    Y.insertIntoIdMap(attrs.deletes, Y.createIdMapFromIdSet(cids.deletes, [Y.createContentAttribute('delete', uid)]))
  })
  root.insert(0, 'hello') // a suggestion relative to v1
  const uid = ydoc.clientID.toString()
  root.useRenderer(Y.createDiffRenderer(v1, ydoc, { attrs }))
  t.assert(root.delta.equals(delta.create().insert('hello', null, { insert: [uid] }).done()))
  t.assert(root.delta.equals(root.toDelta({ deep: true })))
}
