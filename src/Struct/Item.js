import { getReference } from '../Util/structReferences.js'
import ID from '../Util/ID.js'
import { RootFakeUserID } from '../Util/RootID.js'
import Delete from './Delete.js'
import { transactionTypeChanged } from '../Transaction.js'

/**
 * Helper utility to split an Item (see _splitAt)
 * - copy all properties from a to b
 * - connect a to b
 * - assigns the correct _id
 * - save b to os
 */
export function splitHelper (y, a, b, diff) {
  const aID = a._id
  b._id = new ID(aID.user, aID.clock + diff)
  b._origin = a
  b._left = a
  a._right = b
  a._right_origin = b
  b._parent = a._parent
  b._parentSub = a._parentSub
  b._deleted = a._deleted
  y.os.put(b)
}

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
  get _lastId () {
    return new ID(this._id.user, this._id.clock + this._length - 1)
  }
  get _length () {
    return 1
  }
  /**
   * Splits this struct so that another struct can be inserted in-between.
   * This must be overwritten if _length > 1
   * Returns right part after split
   * - diff === 0 => this
   * - diff === length => this._right
   * - otherwise => split _content and return right part of split
   * (see ItemJSON/ItemString for implementation)
   */
  _splitAt (y, diff) {
    if (diff === 0) {
      return this
    }
    return this._right
  }
  _delete (y, createDelete = true) {
    this._deleted = true
    y.ds.markDeleted(this._id, this._length)
    if (createDelete) {
      let del = new Delete()
      del._targetID = this._id
      del._length = this._length
      del._integrate(y, true)
    }
    transactionTypeChanged(y, this._parent, this._parentSub)
  }
  /**
   * This is called right before this struct receives any children.
   * It can be overwritten to apply pending changes before applying remote changes
   */
  _beforeChange () {
    // nop
  }
  /*
   * - Integrate the struct so that other types/structs can see it
   * - Add this struct to y.os
   * - Check if this is struct deleted
   */
  _integrate (y) {
    const parent = this._parent
    const selfID = this._id
    const userState = selfID === null ? 0 : y.ss.getState(selfID.user)
    if (selfID === null) {
      this._id = y.ss.getNextID(this._length)
    } else if (selfID.user === RootFakeUserID) {
      // nop
    } else if (selfID.clock < userState) {
      // already applied..
      return []
    } else if (selfID.clock === userState) {
      y.ss.setState(selfID.user, userState + this._length)
    } else {
      // missing content from user
      throw new Error('Can not apply yet!')
    }
    if (!parent._deleted && !y._transaction.changedTypes.has(parent) && !y._transaction.newTypes.has(parent)) {
      // this is the first time parent is updated
      // or this types is new
      this._parent._beforeChange()
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
      o = this._parent._map.get(this._parentSub) || null
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
      if (this._origin === o._origin) {
        // case 1
        if (o._id.user < this._id.user) {
          this._left = o
          conflictingItems = new Set()
        }
      } else if (itemsBeforeOrigin.has(o)) {
        // case 2
        if (conflictingItems.has(o)) {
          this._left = o
          conflictingItems = new Set()
        }
      } else {
        break
      }
      o = o._right
    }
    // reconnect left/right + update parent map/start if necessary
    const parentSub = this._parentSub
    if (this._left === null) {
      let right
      if (parentSub !== null) {
        const pmap = parent._map
        right = pmap.get(parentSub) || null
        pmap.set(parentSub, this)
      } else {
        right = parent._start
        parent._start = this
      }
      this._right = right
      if (right !== null) {
        right._left = this
      }
    } else {
      const left = this._left
      const right = left._right
      this._right = right
      left._right = this
      if (right !== null) {
        right._left = this
      }
    }
    y.os.put(this)
    transactionTypeChanged(y, parent, parentSub)
    if (this._id.user !== RootFakeUserID) {
      if (y.connector._forwardAppliedStructs || this._id.user === y.userID) {
        y.connector.broadcastStruct(this)
      }
      if (y.persistence !== null) {
        y.persistence.saveOperations(this)
      }
      y.ds.applyMissingDeletesOnStruct(this)
    }
  }
  _toBinary (encoder) {
    encoder.writeUint8(getReference(this.constructor))
    let info = 0
    if (this._origin !== null) {
      info += 0b1 // origin is defined
    }
    if (this._left !== this._origin) {
      info += 0b10 // do not copy origin to left
    }
    if (this._right_origin !== null) {
      info += 0b100
    }
    if (this._parentSub !== null) {
      info += 0b1000
    }
    encoder.writeUint8(info)
    encoder.writeID(this._id)
    if (info & 0b1) {
      encoder.writeID(this._origin._lastId)
    }
    if (info & 0b10) {
      encoder.writeID(this._left._lastId)
    }
    if (info & 0b100) {
      encoder.writeID(this._right_origin._id)
    }
    if (~info & 0b101) {
      // neither origin nor right is defined
      encoder.writeID(this._parent._id)
    }
    if (info & 0b1000) {
      encoder.writeVarString(JSON.stringify(this._parentSub))
    }
  }
  _fromBinary (y, decoder) {
    let missing = []
    const info = decoder.readUint8()
    const id = decoder.readID()
    this._id = id
    // read origin
    if (info & 0b1) {
      // origin != null
      const originID = decoder.readID()
      if (this._origin === null) {
        const origin = y.os.getItemCleanEnd(originID)
        if (origin === null) {
          missing.push(originID)
        } else {
          this._origin = origin
        }
      }
    }
    // read left
    if (info & 0b10) {
      // left !== origin
      const leftID = decoder.readID()
      if (this._left === null) {
        const left = y.os.getItemCleanEnd(leftID)
        if (left === null) {
          // use origin instead
          this._left = this._origin
        } else {
          this._left = left
        }
      }
    } else {
      this._left = this._origin
    }
    // read right
    if (info & 0b100) {
      // right != null
      const rightID = decoder.readID()
      if (this._right_origin === null) {
        const right = y.os.getItemCleanStart(rightID)
        if (right === null) {
          missing.push(rightID)
        } else {
          this._right = right
          this._right_origin = right
        }
      }
    }
    // read parent
    if (~info & 0b101) {
      // neither origin nor right is defined
      const parentID = decoder.readID()
      if (this._parent === null) {
        const parent = y.os.get(parentID)
        if (parent === null) {
          missing.push(parentID)
        } else {
          this._parent = parent
        }
      }
    } else if (this._parent === null) {
      if (this._origin !== null) {
        this._parent = this._origin._parent
      } else if (this._right_origin !== null) {
        this._parent = this._right_origin._parent
      }
    }
    if (info & 0b1000) {
      // TODO: maybe put this in read parent condition (you can also read parentsub from left/right)
      this._parentSub = JSON.parse(decoder.readVarString())
    }
    if (y.ss.getState(id.user) < id.clock) {
      missing.push(new ID(id.user, id.clock - 1))
    }
    return missing
  }
  _logString () {
    return `left: ${this._left}, origin: ${this._origin}, right: ${this._right}, parent: ${this._parent}, parentSub: ${this._parentSub}`
  }
}
