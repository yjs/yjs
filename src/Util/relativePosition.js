import ID from './ID.js'
import RootID from './RootID.js'

export function getRelativePosition (type, offset) {
  let t = type._start
  while (t !== null) {
    if (t._deleted === false) {
      if (t._length > offset) {
        return [t._id.user, t._id.clock + offset]
      }
      offset -= t._length
    }
    t = t._right
  }
  return ['endof', type._id.user, type._id.clock || null, type._id.name || null, type._id.type || null]
}

export function fromRelativePosition (y, rpos) {
  if (rpos[0] === 'endof') {
    let id
    if (rpos[3] === null) {
      id = new ID(rpos[1], rpos[2])
    } else {
      id = new RootID(rpos[3], rpos[4])
    }
    const type = y.os.get(id)
    return {
      type,
      offset: type.length
    }
  } else {
    let offset = 0
    let struct = y.os.findNodeWithUpperBound(new ID(rpos[0], rpos[1])).val
    const parent = struct._parent
    if (parent._deleted) {
      return null
    }
    if (!struct._deleted) {
      offset = rpos[1] - struct._id.clock
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
