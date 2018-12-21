import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import babel from 'rollup-plugin-babel'
import uglify from 'rollup-plugin-uglify-es'

// set this to [] to disable obfuscation
const minificationPlugins = process.env.PRODUCTION ? [babel(), uglify()] : []

export default [{
  input: './index.js',
  output: [{
    name: 'Y',
    file: 'build/yjs.js',
    format: 'cjs',
    sourcemap: true
  }]
}, {
  input: 'tests/index.js',
  output: {
    file: 'build/y.test.js',
    format: 'iife',
    name: 'ytests',
    sourcemap: true
  },
  plugins: [
    nodeResolve({
      main: true,
      module: true
    }),
    commonjs()
  ]
}, {
  input: './examples/codemirror.js',
  output: {
    name: 'codemirror',
    file: 'examples/build/codemirror.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: [
    nodeResolve({
      sourcemap: true,
      module: true
    }),
    commonjs()
  ].concat(minificationPlugins)
}, {
  input: './examples/prosemirror.js',
  output: {
    name: 'prosemirror',
    file: 'examples/build/prosemirror.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: [
    nodeResolve({
      sourcemap: true,
      module: true
    }),
    commonjs()
  ].concat(minificationPlugins)
}, {
  input: './examples/dom.js',
  output: {
    name: 'dom',
    file: 'examples/build/dom.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: minificationPlugins
}, {
  input: './examples/textarea.js',
  output: {
    name: 'textarea',
    file: 'examples/build/textarea.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: minificationPlugins
}, {
  input: './examples/quill.js',
  output: {
    name: 'textarea',
    file: 'examples/build/quill.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: [
    nodeResolve({
      sourcemap: true,
      module: true
    }),
    commonjs()
  ].concat(minificationPlugins)
}]
