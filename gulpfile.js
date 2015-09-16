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
    - build:
        Build this library
    - dev:
        Watch the ./src directory.
        Builds and specs the library on changes.
        Starts an http-server and serves the test suite on http://127.0.0.1:8888.
    - build_test:
        Builds the test suite
    - test:
        Test this library
*/

var gulp = require('gulp')
var sourcemaps = require('gulp-sourcemaps')
var babel = require('gulp-babel')
var uglify = require('gulp-uglify')
var minimist = require('minimist')
var jasmine = require('gulp-jasmine')
var jasmineBrowser = require('gulp-jasmine-browser')
var concat = require('gulp-concat')
var watch = require('gulp-watch')

var options = minimist(process.argv.slice(2), {
  string: ['export', 'name', 'testport', 'testfiles'],
  default: {
    export: 'ignore',
    name: 'y.js',
    testport: '8888',
    testfiles: 'src/**/*.js'
  }
})

var polyfills = [
  './node_modules/gulp-babel/node_modules/babel-core/node_modules/regenerator/runtime.js'
]

var concatOrder = [
  'Helper.spec.js',
  'y.js',
  'Connector.js',
  'OperationStore.js',
  'Struct.js',
  'Utils.js',
  'OperationStores/RedBlackTree.js',
  'OperationStores/Memory.js',
  'OperationStores/IndexedDB.js',
  'Connectors/Test.js',
  'Connectors/WebRTC.js',
  'Types/Array.js',
  'Types/Map.js',
  'Types/TextBind.js'
]

var files = {
  production: polyfills.concat(concatOrder.map(function (f) {
    return 'src/' + f
  })),
  test: concatOrder.map(function (f) {
    return 'build/' + f
  }).concat(['build/**/*.spec.js'])
}

gulp.task('build:deploy', function () {
  gulp.src('src/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(concat('y.js'))
    .pipe(babel({
      loose: 'all',
      modules: 'ignore',
      experimental: true
    }))
    .pipe(uglify())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('.'))
})

gulp.task('build:test', function () {
  gulp.src('src/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(babel({
      loose: 'all',
      modules: 'ignore',
      blacklist: 'regenerator',
      experimental: true
    }))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('build'))
})

gulp.task('dev:node', ['test'], function () {
  gulp.watch('src/**/*.js', ['test'])
})

gulp.task('dev:browser', ['build:test'], function () {
  gulp.watch('src/**/*.js', ['build:test'])

  gulp.src(files.test)
    .pipe(watch(['build/**/*.js']))
    .pipe(jasmineBrowser.specRunner())
    .pipe(jasmineBrowser.server({port: options.testport}))
})

gulp.task('dev', ['build:test'], function () {
  gulp.start('dev:browser')
  gulp.start('dev:node')
})

gulp.task('test', ['build:test'], function () {
  return gulp.src(files.test)
    .pipe(jasmine({
      verbose: true,
      includeStuckTrace: true
    }))
})

gulp.task('default', ['test'])
