// @todo remove

export default [{
  input: {
    yjs: './src/index.js',
    testHelper: './tests/testHelper.js'
  },
  output: {
    dir: 'dist',
    format: 'esm',
    entryFileNames: '[name].js',
    sourcemap: true
  },
  external: id => /^(lib0|@y)\//.test(id)
}]
