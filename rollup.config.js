import nodeResolve from 'rollup-plugin-node-resolve'
import commonjs from 'rollup-plugin-commonjs'
import babel from 'rollup-plugin-babel'
import uglify from 'rollup-plugin-uglify-es'

export default [{
  input: './index.mjs',
  output: [{
    name: 'Y',
    file: 'build/yjs.js',
    format: 'cjs',
    sourcemap: true
  }]
}, {
  input: 'tests/index.mjs',
  output: {
    file: 'build/y.test.mjs',
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
  input: './examples/prosemirror.mjs',
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
    commonjs(),
    babel(),
    uglify()
  ]
}, {
  input: './examples/textarea.mjs',
  output: {
    name: 'textarea',
    file: 'examples/build/textarea.js',
    format: 'iife',
    sourcemap: true
  },
  plugins: [
    uglify()
  ]
}, {
  input: './examples/quill.mjs',
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
    commonjs(),
    babel(),
    uglify()
  ]
}]
