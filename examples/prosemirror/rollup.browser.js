import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'

export default {
  input: './index.js',
  output: {
    name: 'index',
    file: 'index.dist.js',
    format: 'umd',
    sourcemap: true
  },
  plugins: [
    nodeResolve({
      main: true,
      module: true,
      browser: true
    }),
    commonjs()
  ]
}
