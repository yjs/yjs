const resolver = {
  resolveId (importee) {
    return
    if (importee === 'yjs') {
      return `${process.cwd()}/src/index.js`
    }
  }
}

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
  plugins: [
    resolver
  ],
  external: id => /^(lib0|y-protocols)\//.test(id)
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
  plugins: [
    resolver
  ],
  external: id => /^(lib0|y-protocols)\//.test(id)
}]
