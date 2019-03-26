import * as t from 'lib0/testing.js'

class Item {
  constructor (c) {
    this.c = c
  }
}

const objectsToCreate = 10000000

export const testItemHoldsAll = tc => {
  const items = []
  for (let i = 0; i < objectsToCreate; i++) {
    switch (i % 3) {
      case 0:
        items.push(new Item(i))
        break
      case 1:
        items.push(new Item(i + ''))
        break
      case 2:
        items.push(new Item({ x: i }))
        break
      default:
        throw new Error()
    }
  }
  const call = []
  items.forEach(item => {
    switch (item.c.constructor) {
      case Number:
        call.push(item.c + '')
        break
      case String:
        call.push(item.c)
        break
      case Object:
        call.push(item.c.x + '')
        break
      default:
        throw new Error()
    }
  })
}

class CItem { }

class CItemNumber {
  constructor (i) {
    this.c = i
  }
  toString () {
    return this.c + ''
  }
}

class CItemString {
  constructor (s) {
    this.c = s
  }
  toString () {
    return this.c
  }
}

class CItemObject {
  constructor (o) {
    this.c = o
  }
  toString () {
    return this.c.x
  }
}

/*

export const testDifferentItems = tc => {
  const items = []
  for (let i = 0; i < objectsToCreate; i++) {
    switch (i % 3) {
      case 0:
        items.push(new CItemNumber(i))
        break
      case 1:
        items.push(new CItemString(i + ''))
        break
      case 2:
        items.push(new CItemObject({ x: i }))
        break
      default:
        throw new Error()
    }
  }
  const call = []
  items.forEach(item => {
    call.push(item.toString())
  })
}
*/