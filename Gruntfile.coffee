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
        dest: "dest/"
        ext: ".js"
      test:
        #options:
          #bare: true
        expand: true
        src: ["test/**/*.coffee"]
        dest: "dest/"
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
          "examples/*"
        ]
        tasks: ["build"]

    simplemocha:
      all:
        src: ['test/**/*.coffee']
        options:
          timeout: 9999999
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
            extras: ["LICENSE-LGPL", "examples/README.md", "examples/IwcJson.md"]
            #undocumented: yes
            verbose: false
            stats: true
        src: ["./lib"]
    browserify:
      dest:
        files:
          'dest/browser/Yatta_test.js': ['test/**/*.coffee']
        options:
          transform: ['coffeeify']
          debug: true
          bundleOptions: {debug: true}
           # Serve files via http-server
      lib:
        files:
          'dest/browser/Frameworks/JsonIwcYatta.js': ['./lib/Frameworks/JsonYatta.coffee', './lib/Connectors/IwcConnector.coffee']
        options:
          transform: ['coffeeify']
          debug: false
          bundleOptions: {debug: false}
    uglify:
      browser:
        files: [
            expand: true
            cwd: './dest/browser/'
            src: '**/*.js'
            dest: './dest/browser'
            ext: '.min.js'
          ]
    connect:
      server:
        options:
          hostname: '*'
          port: 1337
          base: './'
          keepalive: true
          middleware: (connect, options, middlewares)->
            middlewares.push (req, res, next)->
                if res.header?
                  res.header('Access-Control-Allow-Origin', "*")
                  res.header('Access-Control-Allow-Credentials', true)
                  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
                  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
                  res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0')
                return next()
            return middlewares
    literate:
      "examples/IwcJson.md": "examples/IwcJson.js"
      options:
        code: true

  # These plugins provide necessary tasks.
  grunt.loadNpmTasks "grunt-browserify"
  grunt.loadNpmTasks "grunt-contrib-uglify"
  grunt.loadNpmTasks "grunt-contrib-coffee"
  grunt.loadNpmTasks 'grunt-contrib-connect'
  grunt.loadNpmTasks "grunt-contrib-watch"
  grunt.loadNpmTasks "grunt-literate"
  grunt.loadNpmTasks "grunt-simple-mocha"
  grunt.loadNpmTasks "grunt-coffeelint"
  grunt.loadNpmTasks "grunt-codo"

  grunt.registerTask "build", ["test", "coffee","coffeelint", "literate", "browserify", "uglify", "codo"]
  grunt.registerTask "default", ["build", "watch"]
  grunt.registerTask "production", ["coffee"]
  grunt.registerTask "test", ["simplemocha"]
