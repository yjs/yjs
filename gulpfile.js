/* eslint-env node */

/** Gulp Commands

  gulp command*
    [--export ModuleType]
    [--name ModuleName]
    [--testport TestPort]
    [--testfiles TestFiles]

  Module name (ModuleName):
    Compile this to "y.js" (default)

  Supported module types (ModuleType):
    - amd
    - amdStrict
    - common
    - commonStrict
    - ignore (default)
    - system
    - umd
    - umdStrict

  Test port (TestPort):
    Serve the specs on port 8888 (default)

  Test files (TestFiles):
    Specify which specs to use!

  Commands:
    - build:deploy
        Build this library for deployment (es6->es5, minified)
    - dev:browser
        Watch the ./src directory.
        Builds the library on changes.
        Starts an http-server and serves the test suite on http://127.0.0.1:8888.
    - dev:node
        Watch the ./src directory.
        Builds and specs the library on changes.
        Usefull to run with node-inspector.
        `node-debug $(which gulp) dev:node
    - test:
        Test this library
*/

var gulp = require('gulp')

require('./gulpfile.helper.js')(gulp, {
  polyfills: ['./node_modules/gulp-babel/node_modules/babel-core/node_modules/regenerator/runtime.js'],
  concatOrder: [
    'y.js',
    'Connector.js',
    'Database.js',
    'Transaction.js',
    'Struct.js',
    'Utils.js',
    'Databases/RedBlackTree.js',
    'Databases/Memory.js',
    'Databases/IndexedDB.js',
    'Connectors/Test.js',
    'Connectors/WebRTC.js',
    'Types/Array.js',
    'Types/Map.js',
    'Types/TextBind.js'
  ],
  targetName: 'y.js',
  moduleName: 'yjs'
})

gulp.task('default', ['test'])

gulp.task('copy:dist', function () {
  return gulp.src(['../y-*/dist/*.js', '../y-*/dist/*.js.map'])
    .pipe(gulp.dest('./dist/Examples/bower_components/'))
})

gulp.task('dev:examples', ['dist', 'copy:dist'], function () {
  gulp.watch('src/**/*.js', ['copy:dist'])

  return $.serve('dist/Examples')()
})
