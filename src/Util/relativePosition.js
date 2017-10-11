import ID from './ID'

export function getRelativePosition (type, offset) {
  if (offset === 0) {
    return ['startof', type._id.user, type._id.clock]
  } else {
    let t = type.start
    while (t !== null && t.length < offset) {
      if (!t._deleted) {
        offset -= t.length
      }
      t = t._right
    }
    return [t._id.user, t._id.clock + offset - 1]
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
    let struct = y.os.findNodeWithUpperBound(new ID(rpos[0], rpos[1]))
    let parent = struct._parent
    if (parent._deleted) {
      return null
    }
    if (!struct.deleted) {
      offset = rpos[1] - struct._id.clock
    }
    while (struct.left !== null) {
      struct = struct.left
      if (!struct.deleted) {
        offset += struct._length
      }
    }
    return {
      type: parent,
      offset: offset
    }
  }
}
