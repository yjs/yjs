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
cache = require 'gulp-cached'
coffeeify = require 'gulp-coffeeify'
exit = require 'gulp-exit'

gulp.task 'default', ['build_browser']

files =
  lib : ['./lib/**/*.coffee']
  browser : ['./lib/y.coffee','./lib/y-object.coffee']
  test : ['./test/**/*test.coffee', '../y-*/test/*test.coffee']
  #test : ['./test/Json_test.coffee', './test/Text_test.coffee']
  gulp : ['./gulpfile.coffee']
  examples : ['./examples/**/*.js']
  other: ['./lib/**/*', './test/*']

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

gulp.task 'deploy', ['mocha', 'build_browser', 'deploy_nodejs', 'lint', 'codo']

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
      dirname: "./"
    .pipe gulp.dest './build/test/'

gulp.task 'build_node', ->
  gulp.src files.lib
    .pipe plumber()
    .pipe coffee({bare:true})
    .pipe gulp.dest './build/node'

gulp.task 'build', ['build_node', 'build_browser'], ->

gulp.task 'watch', ['build'], ->
  gulp.watch files.all, ['build']

gulp.task 'mocha', ->
  gulp.src files.test, { read: false }
    .pipe mocha {reporter : 'list'}
    .pipe exit()

gulp.task 'lint', ->
  gulp.src files.all
    .pipe ignore.include '**/*.coffee'
    .pipe coffeelint {
      "max_line_length":
        "level": "ignore"
      }
    .pipe coffeelint.reporter()

gulp.task 'literate', ->
  gulp.src files.examples
    .pipe ljs { code : true }
    .pipe rename
      basename : "README"
      extname : ".md"
    .pipe gulp.dest 'examples/'
    .pipe gulpif '!**/', git.add({args : "-A"})

gulp.task 'codo', [], ()->
  command = './node_modules/codo/bin/codo -o "./doc" --name "yjs" --readme "README.md" --undocumented false --private true --title "yjs API" ./lib - LICENSE.txt '
  run(command).exec()

gulp.task 'clean', ->
  gulp.src ['./build/{browser,test,node}/**/*.{js,map}','./doc/'], { read: false }
    .pipe rimraf()

gulp.task 'default', ['clean','build'], ->
