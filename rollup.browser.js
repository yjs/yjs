import babel from 'rollup-plugin-babel'
import uglify from 'rollup-plugin-uglify'
import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
var pkg = require('./package.json')

export default {
  input: 'src/Y.js',
  name: 'Y',
  sourcemap: true,
  output: {
    file: 'y.js',
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
    uglify({
      mangle: {
        except: ['YMap', 'Y', 'YArray', 'YText', 'YXmlFragment', 'YXmlElement', 'YXmlEvent', 'YXmlText', 'YEvent', 'YArrayEvent', 'YMapEvent', 'Type', 'Delete', 'ItemJSON', 'ItemString', 'Item']
      },
      output: {
        comments: function (node, comment) {
          var text = comment.value
          var type = comment.type
          if (type === 'comment2') {
            // multiline comment
            return /@license/i.test(text)
          }
        }
      }
    })
  ],
  banner: `
/**
 * ${pkg.name} - ${pkg.description}
 * @version v${pkg.version}
 * @license ${pkg.license}
 */
`
}
