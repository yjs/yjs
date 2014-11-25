gulp = require 'gulp'
coffee = require 'gulp-coffee'
concat = require 'gulp-concat'
uglify = require 'gulp-uglify'
sourcemaps = require 'gulp-sourcemaps'
plumber = require 'gulp-plumber'

paths =
  scripts: ['./lib/**/*.coffee']


gulp.task 'scripts', [], ()->
  return gulp.src(paths.scripts)
    .pipe(plumber())
    .pipe(sourcemaps.init())
      .pipe(coffee())
      #.pipe(uglify())
    .pipe(sourcemaps.write('./sourcemaps/'))
    .pipe(gulp.dest('./'))


# Rerun the task when a file changes
gulp.task 'watch', ()->
  gulp.watch(paths.scripts, ['scripts'])

gulp.task('default', ['watch', 'scripts'])









