/*eslint-env node */

/** Gulp Commands

  gulp command* [--export ModuleType] [--name ModuleName] [--testport TestPort]

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

  Commands:
    - build:
        Build this library
    - develop:
        Watch the ./src directory.
        Builds and specs the library on changes.
        Starts an http-server and serves the test suite on http://127.0.0.1:8888.
    - build_test:
        Builds the test suite
    - test:
        Test this library
    - lint:
        Lint this library. A successful lint is required for committing to this repository!

*/


var gulp = require("gulp");
var sourcemaps = require("gulp-sourcemaps");
var babel = require("gulp-babel");
var uglify = require("gulp-uglify");
var minimist = require("minimist");
var eslint = require("gulp-eslint");
var jasmine = require("gulp-jasmine");
var jasmineBrowser = require("gulp-jasmine-browser");
var concat = require("gulp-concat");
var watch = require("gulp-watch");

var files = {
  y: ["src/**/*.js", "!src/**/*.spec.js"],
  lint: ["src/**/*.js", "gulpfile.js"],
  test: ["src/**/*.js"],
  build_test: ["build_test/y.js"]
};

var options = minimist(process.argv.slice(2), {
  string: ["export", "name", "testport"],
  default: {
    export: "ignore",
    name: "y.js",
    testport: "8888"
  }
});

gulp.task("build_test", function () {
  return gulp.src(files.test)
    .pipe(sourcemaps.init())
    .pipe(concat(options.name))
    .pipe(babel({
      loose: "all",
      modules: "ignore"
    }))
    .pipe(uglify())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest("build_test"));
});

gulp.task("build", function () {
  return gulp.src(files.y)
    .pipe(sourcemaps.init())
    .pipe(concat(options.name))
    .pipe(babel({
      loose: "all",
      modules: options.export
    }))
    .pipe(uglify())
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest("."));
});

gulp.task("test", ["build_test"], function () {
  return gulp.src(files.build_test)
    .pipe(jasmine({
      verbose: true,
      includeStuckTrace: true
    }));
});

gulp.task("lint", function(){
  return gulp.src(files.lint)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failOnError());
});

gulp.task("develop", ["test", "build"], function(){
  gulp.src(files.build_test)
    .pipe(watch(files.build_test))
    .pipe(jasmineBrowser.specRunner())
    .pipe(jasmineBrowser.server({port: options.testport}));
  gulp.watch(files.test, ["build_test", "build"]);
  return gulp.watch(files.build_test, ["test"]);
});

gulp.task("default", ["build", "test"]);
