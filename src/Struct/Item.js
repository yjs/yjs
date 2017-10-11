import StructManager from '../Util/StructManager'

export default class Item {
  constructor () {
    this._id = null
    this._origin = null
    this._left = null
    this._right = null
    this._right_origin = null
    this._parent = null
    this._parentSub = null
    this._deleted = false
  }
  get _length () {
    return 1
  }
  _getDistanceToOrigin () {
    if (this.left == null) {
      return 0
    } else {
      var d = 0
      var o = this.left
      while (o !== null && !this.origin.equals(o.id)) {
        d++
        o = o.left
      }
      return d
    }
  }
  _delete (y) {
    this._deleted = true
    y.ds.markDeleted(this._id, this._length)
  }
  /*
   * - Integrate the struct so that other types/structs can see it
   * - Add this struct to y.os
   * - Check if this is struct deleted
   */
  _integrate (y) {
    if (this._id === null) {
      this._id = y.ss.getNextID(this._length)
    }
    /*
    # $this has to find a unique position between origin and the next known character
    # case 1: $origin equals $o.origin: the $creator parameter decides if left or right
    #         let $OL= [o1,o2,o3,o4], whereby $this is to be inserted between o1 and o4
    #         o2,o3 and o4 origin is 1 (the position of o2)
    #         there is the case that $this.creator < o2.creator, but o3.creator < $this.creator
    #         then o2 knows o3. Since on another client $OL could be [o1,o3,o4] the problem is complex
    #         therefore $this would be always to the right of o3
    # case 2: $origin < $o.origin
    #         if current $this insert_position > $o origin: $this ins
    #         else $insert_position will not change
    #         (maybe we encounter case 1 later, then this will be to the right of $o)
    # case 3: $origin > $o.origin
    #         $this insert_position is to the left of $o (forever!)
    */
    // handle conflicts
    let o
    // set o to the first conflicting item
    if (this._left !== null) {
      o = this._left._right
    } else if (this._parentSub !== null) {
      o = this._parent._map.get(this._parentSub)
    } else {
      o = this._parent._start
    }
    let conflictingItems = new Set()
    let itemsBeforeOrigin = new Set()
    // Let c in conflictingItems, b in itemsBeforeOrigin
    // ***{origin}bbbb{this}{c,b}{c,b}{o}***
    // Note that conflictingItems is a subset of itemsBeforeOrigin
    while (o !== null && o !== this._right) {
      itemsBeforeOrigin.add(o)
      if (this.origin === o.origin) {
        // case 1
        if (o._id.user < this._id.user) {
          this.left = o
          conflictingItems = new Set()
        }
      } else if (itemsBeforeOrigin.has(o)) {
        // case 2
        if (conflictingItems.has(o)) {
          this.left = o
          conflictingItems = new Set()
        }
      } else {
        break
      }
      o = o.right
    }
    y.os.set(this)
    y.ds.checkIfDeleted(this)
    if (y.connector._forwardAppliedStructs || this._id.user === y.userID) {
      y.connector.broadcastStruct(this)
    }
    if (y.persistence !== null) {
      y.persistence.saveOperations(this)
    }
  }
  _toBinary (y, encoder) {
    encoder.writeUint8(StructManager.getReference(this.constructor))
    encoder.writeOpID(this._id)
    encoder.writeOpID(this._parent._id)
    encoder.writeVarString(this.parentSub === null ? '' : JSON.stringify(this.parentSub))
    encoder.writeOpID(this._left === null ? null : this._left._id)
    encoder.writeOpID(this._right_origin === null ? null : this._right_origin._id)
    encoder.writeOpID(this._origin === null ? null : this._origin._id)
  }
  _fromBinary (y, decoder) {
    let missing = []
    this._id = decoder.readOpID()
    let parent = decoder.readOpID()
    let parentSub = decoder.readVarString()
    if (parentSub.length > 0) {
      this._parentSub = JSON.parse(parentSub)
    }
    let left = decoder.readOpID()
    let right = decoder.readOpId()
    let origin = decoder.readOpID()
    if (parent !== null && this._parent === null) {
      let _parent = y.os.get(parent)
      if (_parent === null) {
        missing.push(parent)
      } else {
        this._parent = _parent
      }
    }
    if (origin !== null && this._origin === null) {
      let _origin = y.os.getCleanStart(origin)
      if (_origin === null) {
        missing.push(origin)
      } else {
        this._origin = _origin
      }
    }
    if (left !== null && this._left === null) {
      let _left = y.os.getCleanEnd(left)
      if (_left === null) {
        // use origin instead
        this._left = this._origin
      } else {
        this._left = _left
      }
    }
    if (right !== null && this._right_origin === null) {
      let _right = y.os.getCleanStart(right)
      if (_right === null) {
        missing.push(right)
      } else {
        this._right = _right
        this._right_origin = _right
      }
    }
  }
  _logString () {
    return `left: ${this._left}, origin: ${this._origin}, right: ${this._right}, parent: ${this._parent}, parentSub: ${this._parentSub}`
  }
}
