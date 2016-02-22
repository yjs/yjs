
var $ = require('gulp-load-plugins')()
var minimist = require('minimist')
var browserify = require('browserify')
var source = require('vinyl-source-stream')
var buffer = require('vinyl-buffer')

module.exports = function (gulp, helperOptions) {
  var runSequence = require('run-sequence').use(gulp)
  var options = minimist(process.argv.slice(2), {
    string: ['modulename', 'export', 'name', 'port', 'testfiles', 'es6'],
    default: {
      modulename: helperOptions.moduleName,
      targetName: helperOptions.targetName,
      export: 'ignore',
      port: '8888',
      testfiles: '**/*.spec.js',
      es6: false,
      browserify: helperOptions.browserify != null ? helperOptions.browserify : false,
      includeRuntime: helperOptions.includeRuntime || false,
      debug: false
    }
  })
  if (options.es6 !== false) {
    options.es6 = true
  }
  var files = {
    dist: helperOptions.entry,
    specs: helperOptions.specs,
    src: './src/**/*.js'
  }

  if (options.includeRuntime) {
    files.distEs5 = ['node_modules/regenerator/runtime.js', files.dist]
  } else {
    files.distEs5 = [files.dist]
  }

  gulp.task('dist:es5', function () {
    var babelOptions = {
      presets: ['es2015']
    }
    return (browserify({
      entries: files.distEs5,
      debug: true
    }).transform('babelify', babelOptions)
      .bundle()
      .pipe(source(options.targetName))
      .pipe(buffer())
      .pipe($.sourcemaps.init({loadMaps: true}))
      .pipe($.if(!options.debug, $.uglify()))
      .pipe($.sourcemaps.write('.'))
      .pipe(gulp.dest('./dist/')))
  })

  gulp.task('dist:es6', function () {
    return (browserify({
      entries: files.dist,
      debug: true
    }).bundle()
      .pipe(source(options.targetName))
      .pipe(buffer())
      .pipe($.sourcemaps.init({loadMaps: true}))
      // .pipe($.uglify()) -- generators not yet supported see #448
      .pipe($.rename({
        extname: '.es6'
      }))
      .pipe($.sourcemaps.write('.'))

      .pipe(gulp.dest('./dist/')))
  })

  gulp.task('dist', ['dist:es6', 'dist:es5'])

  gulp.task('watch:dist', function (cb) {
    options.debug = true
    gulp.src(['./README.md'])
      .pipe($.watch('./README.md'))
      .pipe(gulp.dest('./dist/'))
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
      debug: true
    }).bundle()
      .pipe(source('specs.js'))
      .pipe(buffer())
      // .pipe($.sourcemaps.init({loadMaps: true}))
      // .pipe($.sourcemaps.write('.'))
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
        'git submodule update --init',
        'cd dist && git pull origin dist'
      ]))
  })

  gulp.task('bump', function () {
    var bumptype
    return gulp.src(['./package.json', './bower.json', './dist/bower.json'], {base: '.'})
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

  gulp.task('publish_commits', function (cb) {
    return gulp.src('./package.json', {read: false})
        .pipe($.prompt.confirm({
          message: 'Are you sure you want to publish this release?',
          default: false
        }))
        .pipe($.shell([
          'cp README.md dist',
          'standard',
          'echo "Deploying version <%= getVersion(file.path) %>"',
          'git pull',
          'cd ./dist/ && git add -A',
          'cd ./dist/ && git commit -am "Deploy <%= getVersion(file.path) %>" -n',
          'cd ./dist/ && git push origin HEAD:dist',
          'cd ./dist/ && git tag -a v<%= getVersion(file.path) %> -m "Release <%= getVersion(file.path) %>"',
          'cd ./dist/ && git push origin --tags',
          'git commit -am "Release <%= getVersion(file.path) %>" -n',
          'git push',
          'npm publish',
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

  gulp.task('publish', function (cb) {
    /* TODO: include 'test',*/
    runSequence('updateSubmodule', 'bump', 'dist', 'publish_commits', cb)
  })
}
