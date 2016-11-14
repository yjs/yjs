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
var $ = require('gulp-load-plugins')()
var runSequence = require('run-sequence').use(gulp)

require('./gulpfile.helper.js')(gulp, {
  polyfills: [],
  entry: './src/y.js',
  targetName: 'y.js',
  moduleName: 'Y',
  includeRuntime: true,
  specs: [
    './src/Database.spec.js',
    '../y-array/src/Array.spec.js',
    '../y-map/src/Map.spec.js'
  ]
})

gulp.task('dev:examples', ['watch:dist'], function () {
  // watch all distfiles and copy them to bower_components
  var distfiles = ['./dist/*.{js,es6}', './dist/*.{js,es6}.map', '../y-*/dist/*.{js,es6}', '../y-*/dist/*.{js,es6}.map']
  gulp.src(distfiles)
    .pipe($.watch(distfiles))
    .pipe($.rename(function (path) {
      var dir = path.dirname.split(/[\\\/]/)[0]
      console.log(JSON.stringify(path))
      path.dirname = dir === '.' ? 'yjs' : dir
    }))
    .pipe(gulp.dest('./dist/Examples/bower_components/'))

  return $.serve('dist/Examples/')()
})

gulp.task('default', ['updateSubmodule'], function (cb) {
  gulp.src('package.json')
    .pipe($.prompt.prompt({
      type: 'checkbox',
      name: 'tasks',
      message: 'Which tasks would you like to run?',
      choices: [
        'test                    Test this project',
        'dev:examples            Serve the examples directory in ./dist/',
        'dev:browser             Watch files & serve the testsuite for the browser',
        'dev:nodejs              Watch filse & test this project with nodejs',
        'bump                    Bump the current state of the project',
        'publish                 Publish this project. Creates a github tag',
        'dist                    Build the distribution files'
      ]
    }, function (res) {
      var tasks = res.tasks.map(function (task) {
        return task.split(' ')[0]
      })
      if (tasks.length > 0) {
        console.info('gulp ' + tasks.join(' '))
        runSequence(tasks, cb)
      } else {
        console.info('Ok, .. goodbye')
      }
    }))
})
