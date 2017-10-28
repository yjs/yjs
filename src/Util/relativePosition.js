import ID from './ID'

export function getRelativePosition (type, offset) {
  if (offset === 0) {
    return ['startof', type._id.user, type._id.clock]
  } else {
    let t = type._start
    while (t !== null) {
      if (t._length >= offset) {
        return [t._id.user, t._id.clock + offset - 1]
      }
      if (t._right === null) {
        return [t._id.user, t._id.clock + t._length - 1]
      }
      if (!t._deleted) {
        offset -= t._length
      }
      t = t._right
    }
    return null
  }
}

export function fromRelativePosition (y, rpos) {
  if (rpos[0] === 'startof') {
    return {
      type: y.os.get(new ID(rpos[1], rpos[2])),
      offset: 0
    }
  } else {
    let offset = 0
    let struct = y.os.findNodeWithUpperBound(new ID(rpos[0], rpos[1])).val
    const parent = struct._parent
    if (parent._deleted) {
      return null
    }
    if (!struct._deleted) {
      offset = rpos[1] - struct._id.clock + 1
    }
    struct = struct._left
    while (struct !== null) {
      if (!struct._deleted) {
        offset += struct._length
      }
      struct = struct._left
    }
    return {
      type: parent,
      offset: offset
    }
  }
}
