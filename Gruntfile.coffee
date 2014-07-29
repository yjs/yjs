"use strict"
module.exports = (grunt) ->

  # Project configuration.
  grunt.initConfig
    coffee:
      lib:
        options:
          bare: true
          sourceMap: true
        expand: true
        src: ["lib/**/*.coffee"]
        dest: "dest/lib"
        ext: ".js"
      test:
        #options:
          #bare: true
        expand: true
        src: ["test/**/*.coffee"]
        dest: "dest/test"
        ext: ".js"

    watch:
      lib:
        files: [
            "<%= coffee.lib.src %>"
        ]
        tasks: ["coffee:lib"]
      test:
        files: [
          "<%= coffee.lib.src %>"
          "<%= coffee.test.src %>"
        ]
        tasks: ["coffeelint", "coffee", "browserify", "test", "codo"]

    simplemocha:
      all:
        src: ['test/**/*.coffee']
        options:
          timeout: 3000
          ignoreLeaks: false
          ui: 'bdd'
          reporter: 'list'
          compilers: 'coffee:coffee-script'

    pkg: grunt.file.readJSON('package.json')

    coffeelint:
      app: [
          'lib/**/*.coffee'
          'test/**/.coffee'
          "Gruntfile.coffee"
          ]
      options:
          "indentation":
              "level": "ignore"
          "no_trailing_whitespace":
              "level": "warn"
          "max_line_length":
              "level": "ignore"
          #"line_endings":
          #    "level": "error"
    codo:
        options:
            name: "Yatta!"
            title: "Yatta! Documentation"
            extras: ["LICENSE-LGPL"]
            #undocumented: yes
            verbose: false
            stats: false
        src: ["./lib"]
    browserify:
      dist:
        files:
          'dest/browser/Yatta.js': ['lib/index.coffee']
          'dest/browser/Yatta_test.js': ['test/**/*.coffee']
        options:
          transform: ['coffeeify']
          debug: true
          bundleOptions: {debug: true}

  # These plugins provide necessary tasks.
  grunt.loadNpmTasks "grunt-browserify"
  grunt.loadNpmTasks "grunt-contrib-coffee"
  grunt.loadNpmTasks "grunt-contrib-watch"
  grunt.loadNpmTasks "grunt-simple-mocha"
  grunt.loadNpmTasks "grunt-coffeelint"
  grunt.loadNpmTasks "grunt-codo"

  grunt.registerTask "default", ["coffee","coffeelint", "browserify", "simplemocha", "watch"]
  grunt.registerTask "production", ["coffee"]
  grunt.registerTask "test", ["simplemocha"]
