import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import multiEntry from 'rollup-plugin-multi-entry'

export default {
  entry: 'tests/*.js',
  moduleName: 'y-array-tests',
  format: 'umd',
  plugins: [
    nodeResolve({
      main: true,
      module: true,
      browser: true
    }),
    commonjs(),
    multiEntry()
  ],
  dest: 'y-array.test.js',
  sourceMap: true
}
