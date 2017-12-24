
export default function simpleDiff (a, b) {
  let left = 0 // number of same characters counting from left
  let right = 0 // number of same characters counting from right
  while (left < a.length && left < b.length && a[left] === b[left]) {
    left++
  }
  if (left !== a.length || left !== b.length) {
    // Only check right if a !== b
    while (right + left < a.length && right + left < b.length && a[a.length - right - 1] === b[b.length - right - 1]) {
      right++
    }
  }
  return {
    pos: left,
    remove: a.length - left - right,
    insert: b.slice(left, b.length - right)
  }
}
