import * as Y from '../src/index.js'
import * as t from 'lib0/testing'

/**
 * autoRef=true embeds nested types as referenced docs and wires refDocs/getRefDoc.
 * @param {t.TestCase} _tc
 */
export const testDocRefAutoRefRegistersRefs = _tc => {
  const root = new Y.Doc({ root: true, autoRef: true })
  const rootMap = root.getMap('root')
  const rootArray = root.getArray('arr')

  const childMap = new Y.Map()
  const childArray = new Y.Array()

  rootMap.set('mapChild', childMap)
  rootArray.insert(0, [childArray])

  const mapDoc = childMap.doc
  const arrayDoc = childArray.doc

  t.assert(mapDoc, 'embedded types materialize docs')
  t.assert(arrayDoc, 'embedded types materialize docs')
  t.assert(root.refDocs.size === 2, 'two ref docs are registered on the root')
  t.assert(root.getRefDoc(mapDoc.guid) === mapDoc, 'getRefDoc resolves map doc')
  t.assert(root.getRefDoc(arrayDoc.guid) === arrayDoc, 'getRefDoc resolves array doc')
  t.assert(rootMap.get('mapChild').doc === mapDoc, 'map entry resolves to ref doc bound type')
  t.assert(rootArray.get(0).doc === arrayDoc, 'array slot resolves to ref doc bound type')
}

/**
 * createRef overrides autoRef on both ends.
 * @param {t.TestCase} _tc
 */
export const testDocRefCreateRefFlagOverridesAutoRef = _tc => {
  const inlineDoc = new Y.Doc({ root: true, autoRef: false })
  const inlineMap = inlineDoc.getMap('root')
  const inlineChild = new Y.Map()
  inlineMap.set('embedded', inlineChild)
  t.assert(inlineDoc.refDocs.size === 0, 'autoRef=false keeps embedded types inline')
  t.assert(inlineChild.doc === inlineDoc, 'embedded type stays on the root doc')

  const forceDoc = new Y.Doc({ root: true, autoRef: false })
  const forceMap = forceDoc.getMap('root')
  const refChild = new Y.Array()
  refChild.createRef = true
  forceMap.set('forced', refChild)
  t.assert(forceDoc.refDocs.size === 1, 'createRef=true forces reference even when autoRef=false')
  t.assert(forceMap.get('forced').doc !== forceDoc, 'forced ref lives on a separate doc')

  const suppressDoc = new Y.Doc({ root: true, autoRef: true })
  const suppressMap = suppressDoc.getMap('root')
  const deepChild = new Y.Text()
  deepChild.createRef = false
  suppressMap.set('deep', deepChild)
  t.assert(suppressDoc.refDocs.size === 0, 'createRef=false prevents automatic ref embedding')
  t.assert(suppressMap.get('deep').doc === suppressDoc, 'deep embed stays on parent doc')
}

/**
 * Reusing the same type value in multiple slots should result in distinct referenced docs with independent content.
 * @param {t.TestCase} _tc
 */
export const testDocRefConflictsClonePerPlacement = _tc => {
  const root = new Y.Doc({ root: true, autoRef: true })
  const map = root.getMap('root')
  const shared = new Y.Map()
  shared.set('title', 'base')

  map.set('first', shared)
  map.set('second', shared)

  const docsByKey = new Map()
  root.refDocs.forEach(doc => {
    const referrer = doc._referrer
    if (referrer?.parentSub) {
      docsByKey.set(referrer.parentSub, doc)
    }
  })

  console.log(docsByKey)
  const firstDoc = docsByKey.get('first')
  const secondDoc = docsByKey.get('second')

  t.assert(firstDoc && secondDoc, 'both placements are backed by docs')
  t.assert(firstDoc !== secondDoc, 'conflicting placements create separate docs')

  const firstRoot = firstDoc?.getMap('')
  const secondRoot = secondDoc?.getMap('')
  firstRoot?.set('title', 'first-only')
  t.assert(secondRoot?.get('title') === 'base', 'cloned docs keep independent state')
}

/**
 * Circular references should be pruned for both map and array placements.
 * @param {t.TestCase} _tc
 */
export const testDocRefCircularReferencesArePruned = _tc => {
  const root = new Y.Doc({ root: true, autoRef: true })
  const rootMap = root.getMap('root')
  const rootArray = root.getArray('arr')

  const child = new Y.Map()
  const arrChild = new Y.Array()

  rootMap.set('child', child)
  rootArray.push([arrChild])

  const backToRoot = root.getMap('root')
  let threw = false
  try {
    child.set('back', backToRoot)
  } catch (err) {
    threw = true
  }
  t.assert(threw, 'attaching root doc causes an error')

  threw = false
  try {
    arrChild.insert(0, [rootArray])
  } catch (err) {
    threw = true
  }
  t.assert(threw, 'attaching root doc in array causes an error')
}

/**
 * Circular refs between non-root docs should be pruned rather than throw.
 * @param {t.TestCase} _tc
 */
export const testDocRefCircularReferencesOnNestedDocsArePruned = _tc => {
  const root = new Y.Doc({ root: true, autoRef: true })
  const rootMap = root.getMap('root')
  const child = new Y.Map()
  rootMap.set('child', child)
  const childDoc = child.doc
  t.assert(childDoc, 'child doc exists')

  const childRoot = childDoc.getMap()
  const grand = new Y.Map()
  childRoot.set('grand', grand)
  const grandDoc = grand.doc
  t.assert(grandDoc, 'grandchild doc exists')

  // detach child so we can reattach it under a descendant to form a cycle
  rootMap.delete('child')
  grand.set('back', childRoot)
  t.assert(grand.has('back') === false, 'non-root circular ref is removed after reattach')
}

/**
 * Removing a ref produces ContentDocUnref entries and clears referrer, and the state survives encode/apply.
 * @param {t.TestCase} _tc
 */
export const testDocRefDeletionAddsUnrefAndSerializes = _tc => {
  const root = new Y.Doc({ root: true, autoRef: true })
  const map = root.getMap('root')
  const child = new Y.Map()
  map.set('child', child)
  const childDoc = child.doc
  t.assert(childDoc, 'child doc exists before deletion')

  map.delete('child')

  t.assert(childDoc?._referrer === null, 'referrer cleared on delete')
  const unrefs = childDoc?.get('_unrefs', Y.Array)
  t.assert(unrefs?.length === 1, 'unref entry added to child doc')
  t.assert(unrefs?.get(0) === childDoc?.guid, 'unref value matches guid')
}

/**
 * Encoding/decoding a doc with refs rebuilds the refDocs hierarchy and nested content.
 * @param {t.TestCase} _tc
 */
export const testDocRefSyncRoundtripRestoresRefs = _tc => {
  const origin = new Y.Doc({ root: true, autoRef: true })
  const map = origin.getMap('root')
  const childArray = new Y.Array()
  childArray.push(['value'])
  map.set('child', childArray)
  const childDoc = /** @type {Y.Doc} */(childArray.doc)

  const update = Y.encodeStateAsUpdateV2(origin)
  const replica = new Y.Doc({ root: true, autoRef: true })
  Y.applyUpdateV2(replica, update)
  const replicatedChildDoc = new Y.Doc({ guid: childDoc.guid })
  replica.addRefDoc(replicatedChildDoc)
  Y.applyUpdateV2(replicatedChildDoc, Y.encodeStateAsUpdateV2(childDoc))

  const replicaMap = replica.getMap('root')
  const replicatedChild = replicaMap.get('child')
  console.log(replicatedChild)
  t.assert(replicatedChild instanceof Y.Array, 'replicated value is array type')
  t.assert(replicatedChildDoc && replica.refDocs.has(replicatedChildDoc.guid), 'refDoc restored on receiver')
  t.assert(replicatedChild.get(0) === 'value', 'nested content survived roundtrip')
}
