
var $ = require('gulp-load-plugins')()
var minimist = require('minimist')

module.exports = function (gulp, helperOptions) {
  var runSequence = require('run-sequence').use(gulp)
  var options = minimist(process.argv.slice(2), {
    string: ['modulename', 'export', 'name', 'testport', 'testfiles', 'regenerator'],
    default: {
      modulename: helperOptions.moduleName,
      targetName: helperOptions.targetName,
      export: 'ignore',
      testport: '8888',
      testfiles: 'src/**/*.js',
      regenerator: process.version < 'v0.12'
    }
  })

  var files = {
    src: helperOptions.polyfills.concat(helperOptions.concatOrder.map(function (f) {
      return 'src/' + f
    })),
    test: ['build/Helper.spec.js'].concat(helperOptions.concatOrder.map(function (f) {
      return 'build/' + f
    }).concat(['build/**/*.spec.js']))
  }

  if (options.regenerator) {
    files.test = helperOptions.polyfills.concat(files.test)
  }

  var babelOptions = {
    loose: 'all',
    modules: 'ignore',
    experimental: true
  }
  if (!options.regenerator) {
    babelOptions.blacklist = 'regenerator'
  }

  gulp.task('dist', function () {
    return gulp.src(files.src)
      .pipe($.sourcemaps.init())
      .pipe($.concat(options.targetName))
      .pipe($.babel({
        loose: 'all',
        modules: 'ignore',
        experimental: true
      }))
      .pipe($.uglify())
      .pipe($.sourcemaps.write('.'))
      .pipe(gulp.dest('./dist/'))
  })

  gulp.task('watch:dist', function () {
    gulp.src(files.src)
      .pipe($.watch(files.src))
      .pipe($.sourcemaps.init())
      .pipe($.concat(options.targetName))
      .pipe($.babel({
        loose: 'all',
        modules: 'ignore',
        experimental: true
      }))
      // .pipe($.uglify())
      .pipe($.sourcemaps.write('.'))
      .pipe(gulp.dest('./dist/'))
  })

  gulp.task('build', function () {
    return gulp.src('src/**/*.js')
      .pipe($.sourcemaps.init())
      .pipe($.babel(babelOptions))
      .pipe($.sourcemaps.write())
      .pipe(gulp.dest('build'))
  })

  gulp.task('watch:build', function () {
    gulp.src('src/**/*.js')
      .pipe($.watch('src/**/*.js'))
      .pipe($.sourcemaps.init())
      .pipe($.babel(babelOptions))
      .pipe($.sourcemaps.write())
      .pipe(gulp.dest('build'))
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
    gulp.watch('src/**/*.js', ['test'])
  })

  gulp.task('dev:browser', ['watch:build'], function () {
    return gulp.src(files.test)
      .pipe($.watch(['build/**/*']))
      .pipe($.jasmineBrowser.specRunner())
      .pipe($.jasmineBrowser.server({port: options.testport}))
  })

  gulp.task('test', ['build'], function () {
    return gulp.src(files.test)
      .pipe($.jasmine({
        verbose: true,
        includeStuckTrace: true
      }))
  })
}
