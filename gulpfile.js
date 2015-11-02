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
var sourcemaps = require('gulp-sourcemaps')
var babel = require('gulp-babel')
var uglify = require('gulp-uglify')
var minimist = require('minimist')
var jasmine = require('gulp-jasmine')
var jasmineBrowser = require('gulp-jasmine-browser')
var concat = require('gulp-concat')
var watch = require('gulp-watch')
var $ = require('gulp-load-plugins')()

var options = minimist(process.argv.slice(2), {
  string: ['export', 'name', 'testport', 'testfiles', 'regenerator'],
  default: {
    export: 'ignore',
    name: 'y.js',
    testport: '8888',
    testfiles: 'src/**/*.js',
    regenerator: process.version < 'v0.12'
  }
})

var polyfills = [
  './node_modules/gulp-babel/node_modules/babel-core/node_modules/regenerator/runtime.js'
]

var concatOrder = [
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
]

var files = {
  src: polyfills.concat(concatOrder.map(function (f) {
    return 'src/' + f
  })),
  test: ['build/Helper.spec.js'].concat(concatOrder.map(function (f) {
    return 'build/' + f
  }).concat(['build/**/*.spec.js']))
}

if (options.regenerator) {
  files.test = polyfills.concat(files.test)
}

gulp.task('deploy:build', function () {
  return gulp.src(files.src)
    .pipe(sourcemaps.init())
    .pipe(concat('y.js'))
    .pipe(babel({
      loose: 'all',
      modules: 'ignore',
      experimental: true
    }))
    .pipe(uglify())
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('.'))
})

gulp.task('deploy:updateSubmodule', function () {
  return $.git.updateSubmodule({ args: '--init' })
})

gulp.task('deploy:copy', ['deploy:build'], function () {
  return gulp.src(['./y.js', './y.js.map', './README.md', 'package.json', 'LICENSE'])
    .pipe(gulp.dest('./dist/'))
})

gulp.task('deploy:bump', function () {
  return gulp.src('./package.json')
    .pipe($.bump({type: 'patch'}))
    .pipe(gulp.dest('./'))
})

gulp.task('deploy:commit', function () {
  return gulp.src(['./*', '!./node_modules', '!./build', '!./y.*', '!./dist'] )
    .pipe($.git.commit('bumps package version', {args: '-n'}))
  /* return gulp.src('./dist/*')
    .pipe($.git.commit('New release', {cwd: './dist/'}))*/
})

gulp.task('deploy:tag', function () {
  return gulp.src('./package.json')
    .pipe($.tagVersion({cwd: './dist'}))
})

gulp.task('deploy', ['deploy:updateSubmodule', 'deploy:bump', 'deploy:copy', 'deploy:commit', 'deploy:tag'], function () {
  $.git.push('origin', 'master', function (err) {
    if (err) throw err
  })
})

gulp.task('build:test', function () {
  var babelOptions = {
    loose: 'all',
    modules: 'ignore',
    experimental: true
  }
  if (!options.regenerator) {
    babelOptions.blacklist = 'regenerator'
  }
  gulp.src(files.src)
    .pipe(sourcemaps.init())
    .pipe(concat('y.js'))
    .pipe(babel(babelOptions))
    .pipe(sourcemaps.write())
    .pipe(gulp.dest('.'))

  return gulp.src('src/**/*.js')
    .pipe(sourcemaps.init())
    .pipe(babel(babelOptions))
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
  var testfiles = files.test
  if (typeof Promise === 'undefined') {
    testfiles.concat(['src/polyfills.js'])
  }
  return gulp.src(testfiles)
    .pipe(jasmine({
      verbose: true,
      includeStuckTrace: true
    }))
})

gulp.task('default', ['test'])
