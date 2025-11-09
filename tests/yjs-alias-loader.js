import { pathToFileURL } from 'url'

/**
 *
 * @param {*} specifier
 * @param {*} context
 * @param {*} nextResolve
 */
export async function resolve (specifier, context, nextResolve) {
  if (specifier === 'yjs') {
    // Redirect all yjs imports to the local YJS implementation to avoid loading multiple YJS instances
    return nextResolve(pathToFileURL('./src/index.js').href, context)
  }
  return nextResolve(specifier, context)
}
