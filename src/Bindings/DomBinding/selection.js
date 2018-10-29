/* globals getSelection */

import { getRelativePosition } from '../../Util/relativePosition.js'

let relativeSelection = null

function _getCurrentRelativeSelection (domBinding) {
  const { baseNode, baseOffset, extentNode, extentOffset } = getSelection()
  const baseNodeType = domBinding.domToType.get(baseNode)
  const extentNodeType = domBinding.domToType.get(extentNode)
  if (baseNodeType !== undefined && extentNodeType !== undefined) {
    return {
      from: getRelativePosition(baseNodeType, baseOffset),
      to: getRelativePosition(extentNodeType, extentOffset)
    }
  }
  return null
}

export const getCurrentRelativeSelection = typeof getSelection !== 'undefined' ? _getCurrentRelativeSelection : domBinding => null

export function beforeTransactionSelectionFixer (domBinding) {
  relativeSelection = getCurrentRelativeSelection(domBinding)
}

/**
 * Reset the browser range after every transaction.
 * This prevents any collapsing issues with the local selection.
 * @private
 */
export function afterTransactionSelectionFixer (domBinding) {
  if (relativeSelection !== null) {
    domBinding.restoreSelection(relativeSelection)
  }
}
