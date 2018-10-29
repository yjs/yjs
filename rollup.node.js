const pkg = require('./package.json')

export default {
  input: 'src/index.js',
  output: {
    name: 'Y',
    file: 'build/node/index.js',
    format: 'cjs',
    sourcemap: true,
    banner: `
/**
 * ${pkg.name} - ${pkg.description}
 * @version v${pkg.version}
 * @license ${pkg.license}
 */
`
  }
}
