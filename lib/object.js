
export const create = Object.create(null)

export const keys = Object.keys

export const equalFlat = (a, b) => {
  const keys = Object.keys(a)
  let eq = keys.length === Object.keys(b).length
  for (let i = 0; i < keys.length && eq; i++) {
    const key = keys[i]
    eq = a[key] === b[key]
  }
  return eq
}
