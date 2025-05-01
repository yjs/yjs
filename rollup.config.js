export default [{
  // cjs output
  input: {
    yjs: './src/index.js',
    testHelper: './tests/testHelper.js',
    internals: './src/internals.js'
  },
  output: {
    dir: 'dist',
    format: 'cjs',
    entryFileNames: '[name].cjs',
    sourcemap: true
  },
  external: id => /^(lib0|@y)\//.test(id)
}, {
  // esm output
  input: {
    yjs: './src/index.js',
    testHelper: './tests/testHelper.js',
    internals: './src/internals.js'
  },
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: '[name].mjs',
    sourcemap: true
  },
  external: id => /^(lib0|@y)\//.test(id)
}]
