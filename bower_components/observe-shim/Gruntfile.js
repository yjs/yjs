//    Copyright 2012 Kap IT (http://www.kapit.fr/)
//
//    Licensed under the Apache License, Version 2.0 (the 'License');
//    you may not use this file except in compliance with the License.
//    You may obtain a copy of the License at
//
//        http://www.apache.org/licenses/LICENSE-2.0
//
//    Unless required by applicable law or agreed to in writing, software
//    distributed under the License is distributed on an 'AS IS' BASIS,
//    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//    See the License for the specific language governing permissions and
//    limitations under the License.
//    Author : François de Campredon (http://francois.de-campredon.fr/),

'use strict';
module.exports = function (grunt) {
    require('matchdep').filterDev('grunt-*').forEach(grunt.loadNpmTasks);

    grunt.initConfig({
        jshint: {
            options: {
                jshintrc: '.jshintrc'
            },
            all: [ 'lib/*.js', 'test/*.js', 'Gruntfile.js' ]
        },
        mocha : {
            index: ['test/index.html'],
            options: {
                run : true,
                log : true
            }
        },
        mochaTest : {
            test: {
                options: {
                    reporter: 'spec'
                },
                src: ['test/node-index.js']
            }
        },
        clean : {
            folder : ['docs']
        },
        docco: {
            src: ['lib/observe-shim.js'],
            options: {
                output: 'docs/'
            }
        }
    });

    grunt.registerTask('test', ['jshint', 'mocha', 'mochaTest']);
    grunt.registerTask('default', ['test', 'clean', 'docco']);
};