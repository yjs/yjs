export const MAX_STRUCTS = 100_000
export const MAX_UPDATES = 100_000
export const MAX_GC_LENGTH = 100_000
export const MAX_SKIP_LENGTH = 100_000

/**
 * @param {number} numOfStateUpdates
 */
export function assertMaxUpdates (numOfStateUpdates) {
  if (numOfStateUpdates > MAX_UPDATES) {
    throw new Error(
      `This update exceeds the maximum number of updates. ${numOfStateUpdates} > ${MAX_UPDATES}`
    )
  }
}

/**
 * @param {number} numberOfStructs
 */
export function assertMaxStructs (numberOfStructs) {
  if (numberOfStructs > MAX_STRUCTS) {
    throw new Error(
      `This update exceeds the maximum number of structs. ${numberOfStructs} > ${MAX_STRUCTS}`
    )
  }
}

/**
 * @param {number} len
 */
export function assertMaxSkipLength (len) {
  if (len > MAX_SKIP_LENGTH) {
    throw new Error(
      `This skip length exceeds the limit. ${len} > ${MAX_SKIP_LENGTH}`
    )
  }
}

/**
 * @param {number} len
 */
export function assertMaxGCLength (len) {
  if (len > MAX_GC_LENGTH) {
    throw new Error(
      `This garbage collection update's length exceeds the limit. ${len} > ${MAX_GC_LENGTH}`
    )
  }
}
