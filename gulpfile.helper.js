
var $ = require('gulp-load-plugins')()
var minimist = require('minimist')

module.exports = function (gulp, helperOptions) {
  var runSequence = require('run-sequence').use(gulp)
  var options = minimist(process.argv.slice(2), {
    string: ['modulename', 'export', 'name', 'testport', 'testfiles'],
    default: {
      modulename: helperOptions.moduleName,
      targetName: helperOptions.targetName,
      export: 'ignore',
      testport: '8888',
      testfiles: '**/*.spec.js',
      browserify: helperOptions.browserify != null ? helperOptions.browserify : false,
      regenerator: true,
      debug: false
    }
  })
  if (options.regenerator === 'false') {
    options.regenerator = false
    // TODO: include './node_modules/gulp-babel/node_modules/babel-core/node_modules/regenerator/runtime.js'
  }
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
    'Types/Array.js',
    'Types/Map.js',
    'Types/TextBind.js'
  ]
  var yjsfiles = concatOrder.map(function (f) {
    return '../yjs/src/' + f
  })
  var files = {
    dist: helperOptions.polyfills.concat(helperOptions.files.map(function (f) {
      return 'src/' + f
    })),
    test: ['../yjs/src/Helper.spec.js'].concat(yjsfiles).concat(helperOptions.files.map(function (f) {
      return 'src/' + f
    }).concat(['src/' + options.testfiles]))
  }

  var babelOptions = {
    loose: 'all',
    modules: 'ignore',
    experimental: true
  }
  if (options.regenerator) {
    files.test = helperOptions.polyfills.concat(files.test)
  } else {
    babelOptions.blacklist = 'regenerator'
  }
  // babelOptions.blacklist = 'regenerator'

  gulp.task('dist', ['build:dist'], function () {
    function createDist (pipe) {
      return pipe
        .pipe($.if(options.debug, $.sourcemaps.init({loadMaps: true})))
        .pipe($.concat(options.targetName))
        .pipe($.if(!options.debug && options.regenerator, $.uglify()))
        .pipe($.if(options.debug, $.sourcemaps.write('.')))
        .pipe(gulp.dest('./dist/'))
    }
    var pipe
    if (options.browserify || true) {
      var browserify = require('browserify')
      var source = require('vinyl-source-stream')
      var buffer = require('vinyl-buffer')

      pipe = browserify({
        entries: 'build/' + options.targetName,
        debug: options.debug
      }).bundle()
        .pipe(source(options.targetName))
        .pipe(buffer())
    } else {
      pipe = gulp.src('build/' + options.targetName)
    }
    return createDist(pipe)
  })

  gulp.task('dist', function () {
    var browserify = require('browserify')
    var source = require('vinyl-source-stream')
    var buffer = require('vinyl-buffer')

    return browserify({
      entries: files.dist,
      debug: options.debug
    }).bundle()
      .pipe(source(options.targetName))
      .pipe(buffer())
      .pipe($.if(options.debug, $.sourcemaps.init({loadMaps: true})))
      .pipe($.concat(options.targetName))
      .pipe($.if(!options.debug && options.regenerator, $.uglify()))
      .pipe($.if(options.debug, $.sourcemaps.write('.')))
      .pipe(gulp.dest('./dist/'))
  })

  gulp.task('watch:dist', function (cb) {
    options.debug = true
    runSequence('dist', function () {
      gulp.watch(files.dist, ['dist'])
      cb()
    })
  })

  gulp.task('updateSubmodule', function () {
    return gulp.src('./package.json', {read: false})
      .pipe($.shell([
        'git submodule update --init'
      ]))
  })

  gulp.task('bump', function () {
    var bumptype
    return gulp.src(['./package.json', './dist/package.json', './dist/bower.json'], {base: '.'})
      .pipe($.prompt.prompt({
        type: 'checkbox',
        name: 'bump',
        message: 'What type of bump would you like to do?',
        choices: ['patch', 'minor', 'major']
      }, function (res) {
        if (res.bump.length === 0) {
          console.info('You have to select a bump type. Now I\'m going to use "patch" as bump type..')
        }
        bumptype = res.bump[0]
      }))
      .pipe($.bump({type: bumptype}))
      .pipe(gulp.dest('./'))
  })

  gulp.task('publish', function (cb) {
    runSequence(['test', 'updateSubmodule', 'dist'], 'bump', function () {
      return gulp.src('./package.json', {read: false})
        .pipe($.prompt.confirm({
          message: 'Are you sure you want to publish this release?',
          default: false
        }))
        .pipe($.shell([
          'cp ./README.md ./dist/',
          'standard',
          'echo "Deploying version <%= getVersion(file.path) %>"',
          'git pull',
          'cd ./dist/ && git add -A',
          'cd ./dist/ && git commit -am "Deploy <%= getVersion(file.path) %>" -n',
          'cd ./dist/ && git push',
          'cd ./dist/ && git tag -a v<%= getVersion(file.path) %> -m "Release <%= getVersion(file.path) %>"',
          'cd ./dist/ && git push origin --tags',
          'git commit -am "Release <%= getVersion(file.path) %>" -n',
          'git push',
          'echo Finished <%= callback() %>'
        ], {
          templateData: {
            getVersion: function (s) {
              return require(s).version
            },
            callback: cb
          }
        }))
    })
  })

  gulp.task('dev:node', ['test'], function () {
    gulp.watch(files.dist, ['test'])
  })

  gulp.task('dev:browser', ['watch:build'], function () {
    return gulp.src(files.test)
      .pipe($.watch(['build/**/*']))
      .pipe($.jasmineBrowser.specRunner())
      .pipe($.jasmineBrowser.server({port: options.testport}))
  })

  gulp.task('test', function () {
    console.log(files.test)
    return gulp.src('./dist/y.js')
      .pipe($.jasmine({
        verbose: true,
        includeStuckTrace: true
      }))
  })
}
