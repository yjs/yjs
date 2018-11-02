import babel from 'rollup-plugin-babel'
import uglify from 'rollup-plugin-uglify'
import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
var pkg = require('./package.json')

export default {
  input: 'src/index.js',
  name: 'Y',
  sourcemap: true,
  output: {
    file: 'build/umd/index.js',
    format: 'umd'
  },
  plugins: [
    nodeResolve({
      main: true,
      module: true,
      browser: true
    }),
    commonjs(),
    babel(),
  ],
  banner: `
/**
 * ${pkg.name} - ${pkg.description}
 * @version v${pkg.version}
 * @license ${pkg.license}
 */
`
}
