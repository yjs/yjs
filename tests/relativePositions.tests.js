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
 * Testing https://github.com/yjs/yjs/issues/657
 *
 * @param {t.TestCase} tc
 */
export const testRelativePositionCase7 = tc => {
  const docA = new Y.Doc()
  const textA = docA.getText('text')
  textA.insert(0, 'abcde')
  // Create a relative position at index 2 in 'textA'
  const relativePosition = Y.createRelativePositionFromTypeIndex(textA, 2)
  // Verify that the absolutes positions on 'docA' are the same
  const absolutePositionWithFollow =
    Y.createAbsolutePositionFromRelativePosition(relativePosition, docA, true)
  const absolutePositionWithoutFollow =
    Y.createAbsolutePositionFromRelativePosition(relativePosition, docA, false)
  t.assert(absolutePositionWithFollow?.index === 2)
  t.assert(absolutePositionWithoutFollow?.index === 2)
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

/**
 * @param {t.TestCase} tc
 */
export const testRelativePositionWithUndo = tc => {
  const ydoc = new Y.Doc()
  const ytext = ydoc.getText()
  ytext.insert(0, 'hello world')
  const rpos = Y.createRelativePositionFromTypeIndex(ytext, 1)
  const um = new Y.UndoManager(ytext)
  ytext.delete(0, 6)
  t.assert(Y.createAbsolutePositionFromRelativePosition(rpos, ydoc)?.index === 0)
  um.undo()
  t.assert(Y.createAbsolutePositionFromRelativePosition(rpos, ydoc)?.index === 1)
  const posWithoutFollow = Y.createAbsolutePositionFromRelativePosition(rpos, ydoc, false)
  console.log({ posWithoutFollow })
  t.assert(Y.createAbsolutePositionFromRelativePosition(rpos, ydoc, false)?.index === 6)
  const ydocClone = new Y.Doc()
  Y.applyUpdate(ydocClone, Y.encodeStateAsUpdate(ydoc))
  t.assert(Y.createAbsolutePositionFromRelativePosition(rpos, ydocClone)?.index === 6)
  t.assert(Y.createAbsolutePositionFromRelativePosition(rpos, ydocClone, false)?.index === 6)
}
