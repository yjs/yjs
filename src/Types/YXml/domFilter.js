
const filterMap = new Map()

export function addFilter (type, filter) {
  if (!filterMap.has(type)) {
    filterMap.set(type, new Set())
  }
  const filters = filterMap.get(type)
  filters.add(filter)
}

export function executeFilter (type) {
  const y = type._y
  let parent = type
  const nodeName = type.nodeName
  let attributes = new Map()
  if (type.getAttributes !== undefined) {
    let attrs = type.getAttributes()
    for (let key in attrs) {
      attributes.set(key, attrs[key])
    }
  }
  let filteredAttributes = new Map(attributes)
  // is not y, supports dom filtering
  while (parent !== y && parent.setDomFilter != null) {
    const filters = filterMap.get(parent)
    if (filters !== undefined) {
      for (let f of filters) {
        filteredAttributes = f(nodeName, filteredAttributes)
        if (filteredAttributes === null) {
          break
        }
      }
      if (filteredAttributes === null) {
        break
      }
    }
    parent = parent._parent
  }
  if (filteredAttributes === null) {
    type._delete(y)
  } else {
    // iterate original attributes
    attributes.forEach((value, key) => {
      // delete all attributes that are not in filteredAttributes
      if (!filteredAttributes.has(key)) {
        type.removeAttribute(key)
      }
    })
  }
}
