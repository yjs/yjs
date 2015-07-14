/*eslint-env node */

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

var polyfills = [
  "./node_modules/gulp-babel/node_modules/babel-core/node_modules/regenerator/runtime.js"
];

var options = minimist(process.argv.slice(2), {
  string: ["export", "name", "testport", "testfiles"],
  default: {
    export: "ignore",
    name: "y.js",
    testport: "8888",
    testfiles: "src/**/*.js"
  }
});

var files = {
  y: polyfills.concat(["src/y.js", "src/**/*.js", "!src/**/*.spec.js"]),
  lint: ["src/**/*.js", "gulpfile.js"],
  test: polyfills.concat([options.testfiles]),
  build_test: ["build_test/y.js"]
};

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

gulp.task("lint", function(){
  return gulp.src(files.lint)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failOnError());
});

gulp.task("test", function () {
  return gulp.src(files.test)
    .pipe(sourcemaps.init())
    .pipe(concat("jasmine"))
    .pipe(babel({
      loose: "all",
      modules: "ignore"
    }))
    .pipe(uglify())
    .pipe(sourcemaps.write())
    .pipe(gulp.dest("build"))
    .pipe(jasmine({
      verbose: true,
      includeStuckTrace: true
    }));
});

gulp.task("build_jasmine_browser", function(){
  gulp.src(files.test)
   .pipe(sourcemaps.init())
   .pipe(concat("jasmine_browser.js"))
   .pipe(babel({
     loose: "all",
     modules: "ignore",
     blacklist: ["regenerator"]
   }))
   .pipe(sourcemaps.write())
   .pipe(gulp.dest("build"));
});


gulp.task("develop", ["build_jasmine_browser", "build"], function(){

  gulp.watch(files.test, ["build_jasmine_browser"]);
  //gulp.watch(files.test, ["test"]);
  //gulp.watch(files.test, ["build"]);

  return gulp.src("build/jasmine_browser.js")
    .pipe(watch("build/jasmine_browser.js"))
    .pipe(jasmineBrowser.specRunner())
    .pipe(jasmineBrowser.server({port: options.testport}));
});

gulp.task("default", ["build", "test"]);
