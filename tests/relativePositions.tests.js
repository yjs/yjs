
import * as Y from '../src/index.js'
import * as t from 'lib0/testing'

/**
 * @param {Y.Text} ytext
 */
const checkRelativePositions = ytext => {
  // test if all positions are encoded and restored correctly
  for (let i = 0; i < ytext.length; i++) {
    // for all types of associations..
    for (let assoc = -1; assoc < 2; assoc++) {
      const rpos = Y.createRelativePositionFromTypeIndex(ytext, i, assoc)
      const encodedRpos = Y.encodeRelativePosition(rpos)
      const decodedRpos = Y.decodeRelativePosition(encodedRpos)
      const absPos = /** @type {Y.AbsolutePosition} */ (Y.createAbsolutePositionFromRelativePosition(decodedRpos, /** @type {Y.Doc} */ (ytext.doc)))
      t.assert(absPos.index === i)
      t.assert(absPos.assoc === assoc)
    }
  }
}

/**
 * @param {t.TestCase} tc
 */
export const testRelativePositionCase1 = tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText()
  ytext.insert(0, '1')
  ytext.insert(0, 'abc')
  ytext.insert(0, 'z')
  ytext.insert(0, 'y')
  ytext.insert(0, 'x')
  checkRelativePositions(ytext)
}

/**
 * @param {t.TestCase} tc
 */
export const testRelativePositionCase2 = tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText()
  ytext.insert(0, 'abc')
  checkRelativePositions(ytext)
}

/**
 * @param {t.TestCase} tc
 */
export const testRelativePositionCase3 = tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText()
  ytext.insert(0, 'abc')
  ytext.insert(0, '1')
  ytext.insert(0, 'xyz')
  checkRelativePositions(ytext)
}

/**
 * @param {t.TestCase} tc
 */
export const testRelativePositionCase4 = tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText()
  ytext.insert(0, '1')
  checkRelativePositions(ytext)
}

/**
 * @param {t.TestCase} tc
 */
export const testRelativePositionCase5 = tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText()
  ytext.insert(0, '2')
  ytext.insert(0, '1')
  checkRelativePositions(ytext)
}

/**
 * @param {t.TestCase} tc
 */
export const testRelativePositionCase6 = tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText()
  checkRelativePositions(ytext)
}

/**
 * @param {t.TestCase} tc
 */
export const testRelativePositionAssociationDifference = tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText()
  ytext.insert(0, '2')
  ytext.insert(0, '1')
  const rposRight = Y.createRelativePositionFromTypeIndex(ytext, 1, 0)
  const rposLeft = Y.createRelativePositionFromTypeIndex(ytext, 1, -1)
  ytext.insert(1, 'x')
  const posRight = Y.createAbsolutePositionFromRelativePosition(rposRight, ydoc)
  const posLeft = Y.createAbsolutePositionFromRelativePosition(rposLeft, ydoc)
  t.assert(posRight != null && posRight.index === 2)
  t.assert(posLeft != null && posLeft.index === 1)
}
