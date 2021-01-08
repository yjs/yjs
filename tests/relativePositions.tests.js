
import * as Y from '../src/internals'
import * as t from 'lib0/testing.js'

/**
 * @param {t.TestCase} tc
 */
export const testRelativePosition = tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText()
  ytext.insert(0, '1')
  ytext.insert(0, 'abc')
  ytext.insert(0, 'z')
  ytext.insert(0, 'y')
  ytext.insert(0, 'x')

  // test if all positions are encoded and restored correctly
  for (let i = 0; i < ytext.length; i++) {
    // for all types of associations..
    for (let assoc = -1; assoc < 2; assoc++) {
      const rpos = Y.createRelativePositionFromTypeIndex(ytext, i, assoc)
      const encodedRpos = Y.encodeRelativePosition(rpos)
      const decodedRpos = Y.decodeRelativePosition(encodedRpos)
      const absPos = /** @type {Y.AbsolutePosition} */ (Y.createAbsolutePositionFromRelativePosition(decodedRpos, ydoc))
      t.assert(absPos.index === i)
      t.assert(absPos.assoc === assoc)
    }
  }
}
