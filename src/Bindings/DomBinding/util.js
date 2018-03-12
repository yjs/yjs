
export function iterateUntilUndeleted (item) {
  while (item !== null && item._deleted) {
    item = item._right
  }
  return item
}

export function removeAssociation (domBinding, dom, type) {
  domBinding.domToType.delete(dom)
  domBinding.typeToDom.delete(type)
}

export function createAssociation (domBinding, dom, type) {
  domBinding.domToType.set(dom, type)
  domBinding.typeToDom.set(type, dom)
}

function insertNodeHelper (yxml, prevExpectedNode, child) {
  let insertedNodes = yxml.insertDomElementsAfter(prevExpectedNode, [child])
  if (insertedNodes.length > 0) {
    return insertedNodes[0]
  } else {
    return prevExpectedNode
  }
}
