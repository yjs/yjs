const structs = new Map()
const references = new Map()

/**
 * Register a new Yjs types. The same type must be defined with the same
 * reference on all clients!
 *
 * @param {Number} reference
 * @param {Function} structConstructor
 *
 * @public
 */
export function registerStruct (reference, structConstructor) {
  structs.set(reference, structConstructor)
  references.set(structConstructor, reference)
}

/**
 * @private
 */
export function getStruct (reference) {
  return structs.get(reference)
}

/**
 * @private
 */
export function getStructReference (typeConstructor) {
  return references.get(typeConstructor)
}
