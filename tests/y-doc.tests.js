import { Doc } from './testHelper.js' // eslint-disable-line

import * as Y from '../src/index.js'
import * as t from 'lib0/testing.js'

/**
 * @param {t.TestCase} tc
 */
export const testToJSON = tc => {
  const doc = new Doc()
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
        'm2k1': 'm2v1'
      }
    }
  }, 'doc.toJSON has array and recursive map')
}