import * as Y from '../src/index.js'
import * as t from 'lib0/testing'

/**
 * Basic doc ref integration via autoRef.
 * @param {t.TestCase} _tc
 */
export const testDocRefBasicLifecycle = _tc => {
  const root = new Y.Doc({ autoRef: true })
  const rootMap = root.getMap('root')
  const child = new Y.Map()

  rootMap.set('child', child)

  const refDocs = Array.from(root.refDocs.values())
  t.assert(refDocs.length === 1, 'child doc registered in refDocs')
  const childDoc = refDocs[0]
  t.assert(childDoc !== root, 'ref doc distinct from root')
  t.assert(rootMap.get('child').doc === childDoc, 'map entry resolves to ref doc type')
  t.assert(root.getRefDoc(childDoc.guid) === childDoc, 'getRefDoc reaches ref doc')
}

/**
 * Conflicting refs should clone the target.
 * @param {t.TestCase} _tc
 */
export const testDocRefConflictClones = _tc => {
  const root = new Y.Doc({ autoRef: true })
  const rootMap = root.getMap('root')
  const shared = new Y.Array()

  rootMap.set('first', shared)
  rootMap.set('second', shared)

  const first = rootMap.get('first')
  const second = rootMap.get('second')

  t.assert(first.doc && second.doc, 'both refs materialize docs')
  t.assert(first.doc.guid !== second.doc.guid, 'conflict creates cloned doc')
  t.assert(root.refDocs.size === 2, 'both docs registered under root')
}

/**
 * Circular refs are pruned.
 * @param {t.TestCase} _tc
 */
export const testDocRefCircularRemoval = _tc => {
  const root = new Y.Doc({ autoRef: true })
  const rootMap = root.getMap('root')
  const child = new Y.Map()

  rootMap.set('child', child)
  const childDoc = child.doc
  t.assert(childDoc, 'child doc exists')

  child.set('back', rootMap)

  t.assert(child.has('back') === false, 'circular ref is removed')
}
