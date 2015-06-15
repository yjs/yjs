/*eslint-env node */

var gulp = require("gulp");
var sourcemaps = require("gulp-sourcemaps");
var babel = require("gulp-babel");
var uglify = require("gulp-uglify");
var minimist = require("minimist");
var eslint = require("gulp-eslint");
var jasmine = require("gulp-jasmine");
var concat = require("gulp-concat");

var moduleName = "y.js";

var files = {
  y: ["src/**/*.js"],
  lint: ["src/**/*.js", "gulpfile.js"],
  tests: ["tests/**/*.js"]
};

var options = minimist(process.argv.slice(2), {
  string: "export",
  default: { export: "ignore" }
});

gulp.task("test", function () {
  return gulp.src(files.y.concat(files.tests))
    .pipe(sourcemaps.init())
    .pipe(concat(moduleName))
    .pipe(babel({
      loose: "all",
      modules: "common"
    }))
    .pipe(uglify())
    .pipe(gulp.dest("build"))
    .pipe(jasmine({
      verbose: true,
      includeStuckTrace: true
    }))
    .pipe(sourcemaps.write("."));
});

gulp.task("build_browser", function () {
  return gulp.src(files.y)
    .pipe(sourcemaps.init())
    .pipe(babel({
      loose: "all",
      modules: "ignore"
    }))
    .pipe(concat(moduleName))
    .pipe(uglify())
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest("."));
});

gulp.task("build_node", function(){
  gulp.src(files.y)
    .pipe(sourcemaps.init())
    .pipe(babel({
      loose: "all",
      modules: "common"
    }))
    .pipe(sourcemaps.write("."))
    .pipe(gulp.dest("./build_node"));
});

gulp.task("lint", function(){
  return gulp.y(files.lint)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failOnError());
});

gulp.task("develop", function(){
  return gulp.watch(files.src, ["build"]);
});

gulp.task("default", ["build"]);
