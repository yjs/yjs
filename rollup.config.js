import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'

const localImports = process.env.LOCALIMPORTS

const customModules = new Set([
  'y-websocket',
  'y-codemirror',
  'y-ace',
  'y-textarea',
  'y-quill',
  'y-dom',
  'y-prosemirror'
])
/**
 * @type {Set<any>}
 */
const customLibModules = new Set([
  'lib0',
  'y-protocols'
])
const debugResolve = {
  resolveId (importee) {
    if (importee === 'yjs') {
      return `${process.cwd()}/src/index.js`
    }
    if (localImports) {
      if (customModules.has(importee.split('/')[0])) {
        return `${process.cwd()}/../${importee}/src/${importee}.js`
      }
      if (customLibModules.has(importee.split('/')[0])) {
        return `${process.cwd()}/../${importee}`
      }
    }
    return null
  }
}

export default [{
  input: './src/index.js',
  output: {
    name: 'Y',
    file: 'dist/yjs.cjs',
    format: 'cjs',
    sourcemap: true
  },
  external: id => /^lib0\//.test(id)
}, {
  input: './src/index.js',
  output: {
    name: 'Y',
    file: 'dist/yjs.mjs',
    format: 'esm',
    sourcemap: true
  },
  external: id => /^lib0\//.test(id)
}, {
  input: './tests/testHelper.js',
  output: {
    name: 'Y',
    file: 'dist/testHelper.mjs',
    format: 'esm',
    sourcemap: true
  },
  external: id => /^lib0\//.test(id) || id === 'yjs',
  plugins: [{
    resolveId (importee) {
      if (importee === '../src/index.js') {
        return 'yjs'
      }
      return null
    }
  }]
}, {
  input: './tests/index.js',
  output: {
    name: 'test',
    file: 'dist/tests.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: [
    debugResolve,
    nodeResolve({
      mainFields: ['browser', 'module', 'main']
    }),
    commonjs()
  ]
}, {
  input: './tests/index.js',
  output: {
    name: 'test',
    file: 'dist/tests.cjs',
    format: 'cjs',
    sourcemap: true
  },
  plugins: [
    debugResolve,
    nodeResolve({
      mainFields: ['node', 'module', 'main'],
      exportConditions: ['node', 'module', 'import', 'default']
    }),
    commonjs()
  ],
  external: id => /^lib0\//.test(id)
}]
