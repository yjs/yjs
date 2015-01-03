gulp = require('gulp')
coffee = require('gulp-coffee')
concat = require('gulp-concat')
uglify = require 'gulp-uglify'
sourcemaps = require('gulp-sourcemaps')
browserify = require('gulp-browserify')
rename = require 'gulp-rename'
rimraf = require 'gulp-rimraf'
gulpif = require 'gulp-if'
ignore = require 'gulp-ignore'
git = require 'gulp-git'
debug = require 'gulp-debug'
coffeelint = require 'gulp-coffeelint'
mocha = require 'gulp-mocha'
run = require 'gulp-run'
ljs = require 'gulp-ljs'
plumber = require 'gulp-plumber'
mochaPhantomJS = require 'gulp-mocha-phantomjs'
cache = require 'gulp-cached'



gulp.task 'default', ['build_browser']

files =
  lib : ['./lib/**/*.coffee']
  build : ['./build/**']
  browser : ['./lib/yatta.coffee','./lib/yatta-element.coffee']
  #test : ['./test/**/*_test.coffee']
  test : ['./test/JsonYatta_test.coffee', './test/TextYatta_test.coffee']
  gulp : ['./gulpfile.coffee']
  examples : ['./examples/**/*.js']
  other: ['./lib/**/*']

files.all = []
for name,file_list of files
  if name isnt 'build'
    files.all = files.all.concat file_list

gulp.task 'deploy_nodejs', ->
  gulp.src files.lib
    .pipe sourcemaps.init()
    .pipe coffee()
    .pipe sourcemaps.write './'
    .pipe gulp.dest 'build/node/'
    .pipe gulpif '!**/', git.add({args : "-A"})

gulp.task 'deploy', ['mocha', 'build_browser', 'deploy_nodejs', 'lint', 'phantom_test', 'codo']

gulp.task 'build_browser', ->
  gulp.src files.browser, { read: false }
    .pipe plumber()
    .pipe browserify
      transform: ['coffeeify']
      extensions: ['.coffee']
      debug : true
    .pipe rename
      extname: ".js"
    .pipe gulp.dest './build/browser/'
    .pipe uglify()
    .pipe gulp.dest '.'

  gulp.src files.test, {read: false}
    .pipe plumber()
    .pipe browserify
      transform: ['coffeeify']
      extensions: ['.coffee']
      debug: true
    .pipe rename
      extname: ".js"
    .pipe gulp.dest './build/test'

gulp.task 'watch', ['build_browser','mocha'], ->
  gulp.watch files.all, ['build_browser', 'mocha']

gulp.task 'mocha', ->
  gulp.src files.test, { read: false }
    .pipe plumber()
    .pipe mocha {reporter : 'list'}
    .pipe ignore.include '**/*.coffee'
    .pipe browserify
      transform: ['coffeeify']
      extensions: ['.coffee']
      debug: true
    .pipe rename
      extname: ".js"
    .pipe gulp.dest 'build/test/'
    .pipe gulpif '!**/', git.add({args : "-A"})

gulp.task 'lint', ->
  gulp.src files.all
    .pipe ignore.include '**/*.coffee'
    .pipe coffeelint {
      "max_line_length":
        "level": "ignore"
      }
    .pipe coffeelint.reporter()

gulp.task 'phantom_watch', ['phantom_test'], ->
  gulp.watch files.all, ['phantom_test']

gulp.task 'literate', ->
  gulp.src files.examples
    .pipe ljs { code : true }
    .pipe rename
      basename : "README"
      extname : ".md"
    .pipe gulp.dest 'examples/'
    .pipe gulpif '!**/', git.add({args : "-A"})

gulp.task 'codo', [], ()->
  command = 'codo -o "./doc" --name "Yatta!" --readme "README.md" --undocumented false --private true --title "Yatta! API" ./lib - LICENSE.txt '
  run(command).exec()

gulp.task 'phantom_test', ['build_browser'], ()->
  gulp.src 'build/test/index.html'
    .pipe mochaPhantomJS()

gulp.task 'clean', ->
  gulp.src './build/{browser,test,node}/**/*.{js,map}', { read: false }
    .pipe ignore '*.html'
    .pipe rimraf()

