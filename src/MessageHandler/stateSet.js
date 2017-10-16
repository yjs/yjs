
export function readStateSet (decoder) {
  let ss = new Map()
  let ssLength = decoder.readUint32()
  for (let i = 0; i < ssLength; i++) {
    let user = decoder.readVarUint()
    let clock = decoder.readVarUint()
    ss.set(user, clock)
  }
  return ss
}

export function writeStateSet (y, encoder) {
  let lenPosition = encoder.pos
  let len = 0
  encoder.writeUint32(0)
  for (let [user, clock] of y.ss.state) {
    encoder.writeVarUint(user)
    encoder.writeVarUint(clock)
    len++
  }
  encoder.setUint32(lenPosition, len)
}
