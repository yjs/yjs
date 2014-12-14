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

/*global describe, it */


describe('observer shim bugs', function () {
    'use strict';
    it('unobserving when there is 2 observer attached to an object, and pending changes records cause an error', function () {
        var obj = {}, observer = function () {}, observer1 = function () {};
        Object.observe(obj, observer);
        Object.observe(obj, observer1);

        Object.getNotifier(obj).notify({type : 'updated'});

        Object.unobserve(obj, observer);
    });
});