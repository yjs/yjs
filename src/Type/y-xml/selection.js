/* globals getSelection */

import { getRelativePosition, fromRelativePosition } from '../../Util/relativePosition.js'

let browserSelection = null
let relativeSelection = null

export let beforeTransactionSelectionFixer
if (typeof getSelection !== 'undefined') {
  beforeTransactionSelectionFixer = function _beforeTransactionSelectionFixer (y, transaction, remote) {
    if (!remote) {
      return
    }
    relativeSelection = { from: null, to: null, fromY: null, toY: null }
    browserSelection = getSelection()
    const anchorNode = browserSelection.anchorNode
    if (anchorNode !== null && anchorNode._yxml != null) {
      const yxml = anchorNode._yxml
      relativeSelection.from = getRelativePosition(yxml, browserSelection.anchorOffset)
      relativeSelection.fromY = yxml._y
    }
    const focusNode = browserSelection.focusNode
    if (focusNode !== null && focusNode._yxml != null) {
      const yxml = focusNode._yxml
      relativeSelection.to = getRelativePosition(yxml, browserSelection.focusOffset)
      relativeSelection.toY = yxml._y
    }
  }
} else {
  beforeTransactionSelectionFixer = function _fakeBeforeTransactionSelectionFixer () {}
}

export function afterTransactionSelectionFixer (y, transaction, remote) {
  if (relativeSelection === null || !remote) {
    return
  }
  const to = relativeSelection.to
  const from = relativeSelection.from
  const fromY = relativeSelection.fromY
  const toY = relativeSelection.toY
  let shouldUpdate = false
  let anchorNode = browserSelection.anchorNode
  let anchorOffset = browserSelection.anchorOffset
  let focusNode = browserSelection.focusNode
  let focusOffset = browserSelection.focusOffset
  if (from !== null) {
    let sel = fromRelativePosition(fromY, from)
    if (sel !== null) {
      let node = sel.type.getDom()
      let offset = sel.offset
      if (node !== anchorNode || offset !== anchorOffset) {
        anchorNode = node
        anchorOffset = offset
        shouldUpdate = true
      }
    }
  }
  if (to !== null) {
    let sel = fromRelativePosition(toY, to)
    if (sel !== null) {
      let node = sel.type.getDom()
      let offset = sel.offset
      if (node !== focusNode || offset !== focusOffset) {
        focusNode = node
        focusOffset = offset
        shouldUpdate = true
      }
    }
  }
  if (shouldUpdate) {
    console.info('updating selection!!')
    browserSelection.setBaseAndExtent(
      anchorNode,
      anchorOffset,
      focusNode,
      focusOffset
    )
  }
}
