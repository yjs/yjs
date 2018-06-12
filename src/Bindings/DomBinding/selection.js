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

export const getCurrentRelativeSelection = typeof getSelection !== 'undefined' ? _getCurrentRelativeSelection : () => null

export function beforeTransactionSelectionFixer (domBinding, remote) {
  if (remote) {
    relativeSelection = getCurrentRelativeSelection(domBinding)
  }
}

/**
 * @private
 */
export function afterTransactionSelectionFixer (domBinding, remote) {
  if (relativeSelection !== null && remote) {
    domBinding.restoreSelection(relativeSelection)
  }
}
