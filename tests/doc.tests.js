
import * as Y from '../src/index.js'
import * as t from 'lib0/testing'

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
  t.compare(arr.toJSON(), ['test1'])

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

    subdocs.set('b', new Y.Doc({ guid: 'a', shouldLoad: false }))
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

/**
 * @param {t.TestCase} tc
 */
export const testSubdocLoadEdgeCases = tc => {
  const ydoc = new Y.Doc()
  const yarray = ydoc.getArray()
  const subdoc1 = new Y.Doc()
  /**
   * @type {any}
   */
  let lastEvent = null
  ydoc.on('subdocs', event => {
    lastEvent = event
  })
  yarray.insert(0, [subdoc1])
  t.assert(subdoc1.shouldLoad)
  t.assert(subdoc1.autoLoad === false)
  t.assert(lastEvent !== null && lastEvent.loaded.has(subdoc1))
  t.assert(lastEvent !== null && lastEvent.added.has(subdoc1))
  // destroy and check whether lastEvent adds it again to added (it shouldn't)
  subdoc1.destroy()
  const subdoc2 = yarray.get(0)
  t.assert(subdoc1 !== subdoc2)
  t.assert(lastEvent !== null && lastEvent.added.has(subdoc2))
  t.assert(lastEvent !== null && !lastEvent.loaded.has(subdoc2))
  // load
  subdoc2.load()
  t.assert(lastEvent !== null && !lastEvent.added.has(subdoc2))
  t.assert(lastEvent !== null && lastEvent.loaded.has(subdoc2))
  // apply from remote
  const ydoc2 = new Y.Doc()
  ydoc2.on('subdocs', event => {
    lastEvent = event
  })
  Y.applyUpdate(ydoc2, Y.encodeStateAsUpdate(ydoc))
  const subdoc3 = ydoc2.getArray().get(0)
  t.assert(subdoc3.shouldLoad === false)
  t.assert(subdoc3.autoLoad === false)
  t.assert(lastEvent !== null && lastEvent.added.has(subdoc3))
  t.assert(lastEvent !== null && !lastEvent.loaded.has(subdoc3))
  // load
  subdoc3.load()
  t.assert(subdoc3.shouldLoad)
  t.assert(lastEvent !== null && !lastEvent.added.has(subdoc3))
  t.assert(lastEvent !== null && lastEvent.loaded.has(subdoc3))
}

/**
 * @param {t.TestCase} tc
 */
export const testSubdocLoadEdgeCasesAutoload = tc => {
  const ydoc = new Y.Doc()
  const yarray = ydoc.getArray()
  const subdoc1 = new Y.Doc({ autoLoad: true })
  /**
   * @type {any}
   */
  let lastEvent = null
  ydoc.on('subdocs', event => {
    lastEvent = event
  })
  yarray.insert(0, [subdoc1])
  t.assert(subdoc1.shouldLoad)
  t.assert(subdoc1.autoLoad)
  t.assert(lastEvent !== null && lastEvent.loaded.has(subdoc1))
  t.assert(lastEvent !== null && lastEvent.added.has(subdoc1))
  // destroy and check whether lastEvent adds it again to added (it shouldn't)
  subdoc1.destroy()
  const subdoc2 = yarray.get(0)
  t.assert(subdoc1 !== subdoc2)
  t.assert(lastEvent !== null && lastEvent.added.has(subdoc2))
  t.assert(lastEvent !== null && !lastEvent.loaded.has(subdoc2))
  // load
  subdoc2.load()
  t.assert(lastEvent !== null && !lastEvent.added.has(subdoc2))
  t.assert(lastEvent !== null && lastEvent.loaded.has(subdoc2))
  // apply from remote
  const ydoc2 = new Y.Doc()
  ydoc2.on('subdocs', event => {
    lastEvent = event
  })
  Y.applyUpdate(ydoc2, Y.encodeStateAsUpdate(ydoc))
  const subdoc3 = ydoc2.getArray().get(0)
  t.assert(subdoc1.shouldLoad)
  t.assert(subdoc1.autoLoad)
  t.assert(lastEvent !== null && lastEvent.added.has(subdoc3))
  t.assert(lastEvent !== null && lastEvent.loaded.has(subdoc3))
}

/**
 * @param {t.TestCase} tc
 */
export const testSubdocsUndo = tc => {
  const ydoc = new Y.Doc()
  const elems = ydoc.getXmlFragment()
  const undoManager = new Y.UndoManager(elems)
  const subdoc = new Y.Doc()
  // @ts-ignore
  elems.insert(0, [subdoc])
  undoManager.undo()
  undoManager.redo()
  t.assert(elems.length === 1)
}

/**
 * @param {t.TestCase} tc
 */
export const testLoadDocs = async tc => {
  const ydoc = new Y.Doc()
  t.assert(ydoc.isLoaded === false)
  let loadedEvent = false
  ydoc.on('load', () => {
    loadedEvent = true
  })
  ydoc.emit('load', [ydoc])
  await ydoc.whenLoaded
  t.assert(loadedEvent)
  t.assert(ydoc.isLoaded)
}
