import isParentOf from '../../Util/isParentOf.js'

export function defaultFilter (nodeName, attrs) {
  return attrs
}


export function applyFilterOnType (y, binding, type) {
  if (isParentOf(binding.type, type)) {
    const nodeName = type.nodeName
    let attributes = new Map()
    if (type.getAttributes !== undefined) {
      let attrs = type.getAttributes()
      for (let key in attrs) {
        attributes.set(key, attrs[key])
      }
    }
    const filteredAttributes = binding.filter(nodeName, new Map(attributes))
    if (filteredAttributes === null) {
      type._delete(y)
    } else {
      // iterate original attributes
      attributes.forEach((value, key) => {
        // delete all attributes that are not in filteredAttributes
        if (filteredAttributes.has(key) === false) {
          type.removeAttribute(key)
        }
      })
    }
  }
}
