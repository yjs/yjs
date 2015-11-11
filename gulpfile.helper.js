
var $ = require('gulp-load-plugins')()
var minimist = require('minimist')

module.exports = function (gulp, helperOptions) {
  var runSequence = require('run-sequence').use(gulp)
  var options = minimist(process.argv.slice(2), {
    string: ['modulename', 'export', 'name', 'port', 'testfiles'],
    default: {
      modulename: helperOptions.moduleName,
      targetName: helperOptions.targetName,
      export: 'ignore',
      port: '8888',
      testfiles: '**/*.spec.js',
      browserify: helperOptions.browserify != null ? helperOptions.browserify : false,
      regenerator: false,
      debug: false
    }
  })
  if (options.regenerator === 'false') {
    options.regenerator = false
    // TODO: include './node_modules/gulp-babel/node_modules/babel-core/node_modules/regenerator/runtime.js'
  }
  var files = {
    dist: helperOptions.entry,
    specs: helperOptions.specs,
    src: './src/**/*.js'
  }

  var babelOptions = {
    loose: 'all',
    modules: 'ignore',
    experimental: true
  }
  if (options.regenerator) {
    files.specs = helperOptions.polyfills.concat(files.specs)
  } else {
    babelOptions.blacklist = 'regenerator'
  }

  gulp.task('dist', function () {
    var browserify = require('browserify')
    var source = require('vinyl-source-stream')
    var buffer = require('vinyl-buffer')

    gulp.src(['./README.md'])
      .pipe($.watch('./README.md'))
      .pipe(gulp.dest('./dist/'))

    return browserify({
      entries: files.dist,
      debug: options.debug
    }).bundle()
      .pipe(source(options.targetName))
      .pipe(buffer())
      .pipe($.if(options.debug, $.sourcemaps.init({loadMaps: true})))
      .pipe($.if(!options.debug && options.regenerator, $.babel(babelOptions)))
      .pipe($.if(!options.debug && options.regenerator, $.uglify()))
      .pipe($.if(options.debug, $.sourcemaps.write('.')))
      .pipe(gulp.dest('./dist/'))
  })

  gulp.task('watch:dist', function (cb) {
    options.debug = true
    runSequence('dist', function () {
      gulp.watch(files.src.concat('./README.md'), ['dist'])
      cb()
    })
  })

  gulp.task('dev:node', ['test'], function () {
    gulp.watch(files.src, ['test'])
  })

  gulp.task('spec-build', function () {
    var browserify = require('browserify')
    var source = require('vinyl-source-stream')
    var buffer = require('vinyl-buffer')

    return browserify({
      entries: files.specs,
      debug: options.debug
    }).bundle()
      .pipe(source('specs.js'))
      .pipe(buffer())
      .pipe($.sourcemaps.init({loadMaps: true}))
      .pipe($.sourcemaps.write('.'))
      .pipe(gulp.dest('./build/'))
  })

  gulp.task('dev:browser', ['spec-build'], function () {
    gulp.watch(files.src, ['spec-build'])
    return gulp.src('./build/specs.js')
      .pipe($.jasmineBrowser.specRunner())
      .pipe($.jasmineBrowser.server({port: options.port}))
  })

  gulp.task('test', function () {
    return gulp.src(files.specs)
      .pipe($.jasmine({
        verbose: true,
        includeStuckTrace: true
      }))
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
}
