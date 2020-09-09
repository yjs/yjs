
import * as Y from '../src/index.js'
import * as t from 'lib0/testing.js'

/**
 * Client id should be changed when an instance receives updates from another client using the same client id.
 *
 * @param {t.TestCase} tc
 */
export const testClientIdDuplicateChange = tc => {
  const doc1 = new Y.Doc()
  doc1.clientID = 0
  const doc2 = new Y.Doc()
  doc2.clientID = 0
  t.assert(doc2.clientID === doc1.clientID)
  doc1.getArray('a').insert(0, [1, 2])
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))
  t.assert(doc2.clientID !== doc1.clientID)
}

/**
 * @param {t.TestCase} tc
 */
export const testGetTypeEmptyId = tc => {
  const doc1 = new Y.Doc()
  doc1.getText('').insert(0, 'h')
  doc1.getText().insert(1, 'i')
  const doc2 = new Y.Doc()
  Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc1))
  t.assert(doc2.getText().toString() === 'hi')
  t.assert(doc2.getText('').toString() === 'hi')
}

/**
 * @param {t.TestCase} tc
 */
export const testToJSON = tc => {
  const doc = new Y.Doc()
  t.compare(doc.toJSON(), {}, 'doc.toJSON yields empty object')

  const arr = doc.getArray('array')
  arr.push(['test1'])

  const map = doc.getMap('map')
  map.set('k1', 'v1')
  const map2 = new Y.Map()
  map.set('k2', map2)
  map2.set('m2k1', 'm2v1')

  t.compare(doc.toJSON(), {
    array: ['test1'],
    map: {
      k1: 'v1',
      k2: {
        m2k1: 'm2v1'
      }
    }
  }, 'doc.toJSON has array and recursive map')
}

/**
 * @param {t.TestCase} tc
 */
export const testSubdoc = tc => {
  const doc = new Y.Doc()
  doc.load() // doesn't do anything
  {
    /**
     * @type {Array<any>|null}
     */
    let event = /** @type {any} */ (null)
    doc.on('subdocs', subdocs => {
      event = [Array.from(subdocs.added).map(x => x.guid), Array.from(subdocs.removed).map(x => x.guid), Array.from(subdocs.loaded).map(x => x.guid)]
    })
    const subdocs = doc.getMap('mysubdocs')
    const docA = new Y.Doc({ guid: 'a' })
    docA.load()
    subdocs.set('a', docA)
    t.compare(event, [['a'], [], ['a']])

    event = null
    subdocs.get('a').load()
    t.assert(event === null)

    event = null
    subdocs.get('a').destroy()
    t.compare(event, [['a'], ['a'], []])
    subdocs.get('a').load()
    t.compare(event, [[], [], ['a']])

    subdocs.set('b', new Y.Doc({ guid: 'a' }))
    t.compare(event, [['a'], [], []])
    subdocs.get('b').load()
    t.compare(event, [[], [], ['a']])

    const docC = new Y.Doc({ guid: 'c' })
    docC.load()
    subdocs.set('c', docC)
    t.compare(event, [['c'], [], ['c']])

    t.compare(Array.from(doc.getSubdocGuids()), ['a', 'c'])
  }

  const doc2 = new Y.Doc()
  {
    t.compare(Array.from(doc2.getSubdocs()), [])
    /**
     * @type {Array<any>|null}
     */
    let event = /** @type {any} */ (null)
    doc2.on('subdocs', subdocs => {
      event = [Array.from(subdocs.added).map(d => d.guid), Array.from(subdocs.removed).map(d => d.guid), Array.from(subdocs.loaded).map(d => d.guid)]
    })
    Y.applyUpdate(doc2, Y.encodeStateAsUpdate(doc))
    t.compare(event, [['a', 'a', 'c'], [], []])

    doc2.getMap('mysubdocs').get('a').load()
    t.compare(event, [[], [], ['a']])

    t.compare(Array.from(doc2.getSubdocGuids()), ['a', 'c'])

    doc2.getMap('mysubdocs').delete('a')
    t.compare(event, [[], ['a'], []])
    t.compare(Array.from(doc2.getSubdocGuids()), ['a', 'c'])
  }
}
