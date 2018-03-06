
import YMap from '../Types/YMap'
import YArray from '../Types/YArray'

export function writeObjectToYMap (object, type) {
  for (var key in object) {
    var val = object[key]
    if (Array.isArray(val)) {
      type.set(key, YArray)
      writeArrayToYArray(val, type.get(key))
    } else if (typeof val === 'object') {
      type.set(key, YMap)
      writeObjectToYMap(val, type.get(key))
    } else {
      type.set(key, val)
    }
  }
}

export function writeArrayToYArray (array, type) {
  for (var i = array.length - 1; i >= 0; i--) {
    var val = array[i]
    if (Array.isArray(val)) {
      type.insert(0, [YArray])
      writeArrayToYArray(val, type.get(0))
    } else if (typeof val === 'object') {
      type.insert(0, [YMap])
      writeObjectToYMap(val, type.get(0))
    } else {
      type.insert(0, [val])
    }
  }
}
