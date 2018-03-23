/* globals getSelection */

import { getRelativePosition, fromRelativePosition } from '../../Util/relativePosition.js'

let browserSelection = null
let relativeSelection = null

export let beforeTransactionSelectionFixer
if (typeof getSelection !== 'undefined') {
  beforeTransactionSelectionFixer = function _beforeTransactionSelectionFixer (y, domBinding, transaction, remote) {
    if (!remote) {
      return
    }
    relativeSelection = { from: null, to: null, fromY: null, toY: null }
    browserSelection = getSelection()
    const anchorNode = browserSelection.anchorNode
    const anchorNodeType = domBinding.domToType.get(anchorNode)
    if (anchorNode !== null && anchorNodeType !== undefined) {
      relativeSelection.from = getRelativePosition(anchorNodeType, browserSelection.anchorOffset)
      relativeSelection.fromY = anchorNodeType._y
    }
    const focusNode = browserSelection.focusNode
    const focusNodeType = domBinding.domToType.get(focusNode)
    if (focusNode !== null && focusNodeType !== undefined) {
      relativeSelection.to = getRelativePosition(focusNodeType, browserSelection.focusOffset)
      relativeSelection.toY = focusNodeType._y
    }
  }
} else {
  beforeTransactionSelectionFixer = function _fakeBeforeTransactionSelectionFixer () {}
}

export function afterTransactionSelectionFixer (y, domBinding, transaction, remote) {
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
      let node = domBinding.typeToDom.get(sel.type)
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
      let node = domBinding.typeToDom.get(sel.type)
      let offset = sel.offset
      if (node !== focusNode || offset !== focusOffset) {
        focusNode = node
        focusOffset = offset
        shouldUpdate = true
      }
    }
  }
  if (shouldUpdate) {
    browserSelection.setBaseAndExtent(
      anchorNode,
      anchorOffset,
      focusNode,
      focusOffset
    )
  }
}
