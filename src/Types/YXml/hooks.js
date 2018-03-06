
const xmlHooks = {}

export function addHook (name, hook) {
  xmlHooks[name] = hook
}

export function getHook (name) {
  const hook = xmlHooks[name]
  if (hook === undefined) {
    throw new Error(`The hook "${name}" is not specified! You must not access this hook!`)
  }
  return hook
}
