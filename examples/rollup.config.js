import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'

var pkg = require('./package.json')

export default {
  entry: 'yjs-dist.esm',
  dest: 'yjs-dist.js',
  moduleName: 'Y',
  format: 'umd',
  plugins: [
    nodeResolve({
      main: true,
      module: true,
      browser: true
    }),
    commonjs()
  ],
  sourceMap: true,
  banner: `
/**
 * ${pkg.name} - ${pkg.description}
 * @version v${pkg.version}
 * @license ${pkg.license}
 */
`
}
