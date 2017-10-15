import deleteItemRange from 'deleteItemRange'

export function stringifyDeleteSet (y, decoder, strBuilder) {
  let dsLength = decoder.readUint32()
  for (let i = 0; i < dsLength; i++) {
    let user = decoder.readVarUint()
    strBuilder.push(' -' + user + ':')
    let dvLength = decoder.readVarUint()
    for (let j = 0; j < dvLength; j++) {
      let from = decoder.readVarUint()
      let len = decoder.readVarUint()
      let gc = decoder.readUint8() === 1
      strBuilder.push(`clock: ${from}, length: ${len}, gc: ${gc}`)
    }
  }
  return strBuilder
}

export function writeDeleteSet (y, encoder) {
  let currentUser = null
  let currentLength = 0
  let lastLenPos

  let numberOfUsers = 0
  let laterDSLenPus = encoder.pos
  encoder.writeUint32(0)

  y.ds.iterate(null, null, function (n) {
    var user = n._id.user
    var clock = n._id.clock
    var len = n.len
    var gc = n.gc
    if (currentUser !== user) {
      numberOfUsers++
      // a new user was found
      if (currentUser !== null) { // happens on first iteration
        encoder.setUint32(lastLenPos, currentLength)
      }
      encoder.writeVarUint(user)
      // pseudo-fill pos
      lastLenPos = encoder.pos
      encoder.writeUint32(0)
    }
    encoder.writeVarUint(clock)
    encoder.writeVarUint(len)
    encoder.writeUint8(gc ? 1 : 0)
  })
  if (currentUser !== null) { // happens on first iteration
    encoder.setUint32(lastLenPos, currentLength)
  }
  encoder.writeUint32(laterDSLenPus, numberOfUsers)
}

export function readDeleteSet (y, decoder) {
  let dsLength = decoder.readUint32()
  for (let i = 0; i < dsLength; i++) {
    let user = decoder.readVarUint()
    let dv = []
    let dvLength = decoder.readVarUint()
    for (let j = 0; j < dvLength; j++) {
      let from = decoder.readVarUint()
      let len = decoder.readVarUint()
      let gc = decoder.readUint8() === 1
      dv.push([from, len, gc])
    }
    var pos = 0
    var d = dv[pos]
    y.ds.iterate([user, 0], [user, Number.MAX_VALUE], function (n) {
      // cases:
      // 1. d deletes something to the right of n
      //  => go to next n (break)
      // 2. d deletes something to the left of n
      //  => create deletions
      //  => reset d accordingly
      //  *)=> if d doesn't delete anything anymore, go to next d (continue)
      // 3. not 2) and d deletes something that also n deletes
      //  => reset d so that it doesn't contain n's deletion
      //  *)=> if d does not delete anything anymore, go to next d (continue)
      while (d != null) {
        var diff = 0 // describe the diff of length in 1) and 2)
        if (n.id[1] + n.len <= d[0]) {
          // 1)
          break
        } else if (d[0] < n.id[1]) {
          // 2)
          // delete maximum the len of d
          // else delete as much as possible
          diff = Math.min(n.id[1] - d[0], d[1])
          deleteItemRange(y, user, d[0], diff)
          // deletions.push([user, d[0], diff, d[2]])
        } else {
          // 3)
          diff = n.id[1] + n.len - d[0] // never null (see 1)
          if (d[2] && !n.gc) {
            // d marks as gc'd but n does not
            // then delete either way
            deleteItemRange(y, user, d[0], Math.min(diff, d[1]))
            // deletions.push([user, d[0], Math.min(diff, d[1]), d[2]])
          }
        }
        if (d[1] <= diff) {
          // d doesn't delete anything anymore
          d = dv[++pos]
        } else {
          d[0] = d[0] + diff // reset pos
          d[1] = d[1] - diff // reset length
        }
      }
    })
    // for the rest.. just apply it
    for (; pos < dv.length; pos++) {
      d = dv[pos]
      deleteItemRange(y, user, d[0], d[1])
      // deletions.push([user, d[0], d[1], d[2]])
    }
  }
}
