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

/*global describe, it, expect , beforeEach, afterEach, sinon*/

describe('Observe.observe harmony proposal shim', function () {
    'use strict';


    function testIsObject(testFunc) {
        expect(function () {
            testFunc(5);
        }).to.throwException(function (e) {
            expect(e).to.be.a(TypeError);
        });

        expect(function () {
            testFunc('string');
        }).to.throwException(function (e) {
            expect(e).to.be.a(TypeError);
        });

        expect(function () {
            testFunc(NaN);
        }).to.throwException(function (e) {
            expect(e).to.be.a(TypeError);
        });

        expect(function () {
            testFunc(null);
        }).to.throwException(function (e) {
            expect(e).to.be.a(TypeError);
        });

        expect(function () {
            testFunc(undefined);
        }).to.throwException(function (e) {
            expect(e).to.be.a(TypeError);
        });

        expect(function () {
            testFunc({});
        }).to.not.throwException();

        expect(function () {
            testFunc(function () {});
        }).to.not.throwException();
    }

    function testIsCallable(testFunc) {
        expect(function () {
            testFunc(5);
        }).to.throwException(function (e) {
            expect(e).to.be.a(TypeError);
        });

        expect(function () {
            testFunc('string');
        }).to.throwException(function (e) {
            expect(e).to.be.a(TypeError);
        });

        expect(function () {
            testFunc(NaN);
        }).to.throwException(function (e) {
            expect(e).to.be.a(TypeError);
        });

        expect(function () {
            testFunc(null);
        }).to.throwException(function (e) {
            expect(e).to.be.a(TypeError);
        });

        expect(function () {
            testFunc(undefined);
        }).to.throwException(function (e) {
            expect(e).to.be.a(TypeError);
        });

        expect(function () {
            testFunc({});
        }).to.throwException(function (e) {
            expect(e).to.be.a(TypeError);
        });

        expect(function () {
            //tricks for jshint
            var Fn = Function;
            testFunc(new Fn(''));
        }).to.not.throwException();

        expect(function () {
            testFunc(function () {});
        }).to.not.throwException();
    }

    describe('Object.observe', function () {
        it('should throw an error when passing an non object at first parameter', function () {
            testIsObject(function (target) {
                Object.observe(target, function () {  });
            });
        });

        it('should throw an error when second parameter is not callable', function () {
            testIsCallable(function (observer) {
                Object.observe({}, observer);
            });
        });

        it('should throw an error when second parameter is frozen', function () {
            var observer = function () { };
            Object.freeze(observer);
            expect(function () {
                Object.observe({}, observer);
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });

        it('should throw an error when third parameter is defined and is not an array like of string', function () {
            expect(function () {
                Object.observe({}, function () {}, {});
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.observe({}, function () {}, [5, {}]);
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });

            expect(function () {
                Object.observe({}, function () {}, ['hello', '']);
            }).to.not.throwException();
        });

    });

    describe('Object.unobserve', function () {
        it('should throw an error when passing an non object at first parameter', function () {
            testIsObject(function (target) {
                Object.unobserve(target, function () {  });
            });
        });

        it('should throw an error when second parameter is not callable', function () {
            testIsCallable(function (observer) {
                Object.unobserve({}, observer);
            });
        });


    });

    describe('Object.getNotifier', function () {
        it('should throw an error when passing an non object at first parameter', function () {
            testIsObject(function (target) {
                Object.getNotifier(target);
            });
        });



        it('should return a notifier with a "notify" function,  configurable, writable and not enumerable', function () {
            var notifier = Object.getNotifier({}),
                notifyDesc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(notifier), 'notify');

            expect(notifyDesc).to.be.ok();
            expect(notifyDesc.value).to.be.a('function');
            expect(notifyDesc.configurable).to.be.ok();
            expect(notifyDesc.writable).to.be.ok();
            expect(notifyDesc.enumerable).not.to.be.ok();
        });


        it('should return a unique notifier for a given object', function () {
            var obj = {},
                notifier = Object.getNotifier(obj),
                notifier1 = Object.getNotifier(obj);

            expect(notifier).to.be.equal(notifier1);
        });
    });

    describe('Object.deliverChangeRecords', function () {
        it('should throw an error when passing an non object at first parameter', function () {
            testIsCallable(function (observer) {
                Object.deliverChangeRecords(observer);
            });
        });

    });


    describe('Notifier.notify', function () {

        var notifier = Object.getNotifier({});

        it('should throw an error when passing an non-object as parameter', function () {
            expect(function () {
                notifier.notify(5);
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });


        it('should throw an error when the property type of the first parameter is not a string', function () {
            expect(function () {
                notifier.notify({ type: 4 });
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });


    });


    describe('Notifier.performChange', function () {

        var notifier = Object.getNotifier({});

        it('should throw an error when passing a non string as first parameter', function () {
            expect(function () {
                notifier.performChange(null, function () {});
            }).to.throwException(function (e) {
                expect(e).to.be.a(TypeError);
            });
        });

        it('should throw an error when second parameter is not callable', function () {
            testIsCallable(function (observer) {
                notifier.performChange('update', observer);
            });
        });

        it('should call the changeFunction', function () {
            var spy = sinon.spy();
            notifier.performChange('update', spy);
            expect(spy.calledOnce).to.be.ok();
        });


        it('should rethrow any error thrown by the changeFunction', function () {
            expect(function () {
                notifier.performChange('update', function () {
                    throw new RangeError('changeFunction exception');
                });
            }).to.throwException(function (e) {
                expect(e).to.be.a(RangeError);
                expect(e.message).to.be('changeFunction exception');
            });
        });

    });

    describe('Changes delivery', function () {
        var obj, notifier, observer;

        beforeEach(function () {
            obj = {};
            observer = sinon.spy();
            Object.observe(obj, observer);
            notifier = Object.getNotifier(obj);
        });

        afterEach(function () {
            Object.unobserve(obj, observer);
            obj = observer = notifier = null;
        });


        function getDeliveredRecords() {
            return observer.args[0][0];
        }


        it('should call the observer when a change record is delivered', function () {
            notifier.notify({
                type: 'update',
                name: 'foo'
            });

            Object.deliverChangeRecords(observer);
            expect(observer.calledOnce).to.be.ok();
        });


        it('should call the observer only one time when multiples changes records are delivered', function () {
            notifier.notify({
                type: 'update',
                name: 'foo'
            });
            notifier.notify({
                type: 'update',
                name: 'foo'
            });

            Object.deliverChangeRecords(observer);
            expect(observer.calledOnce).to.be.ok();
        });


        it('should call the observer only one time when multiples changes records are delivered', function () {
            notifier.notify({
                type: 'update'
            });
            notifier.notify({
                type: 'update'
            });

            Object.deliverChangeRecords(observer);
            expect(observer.calledOnce).to.be.ok();
        });


        it('should deliver a change  record  with a property "object" corresponding to the observed object', function () {
            notifier.notify({
                type: 'update'
            });
            Object.deliverChangeRecords(observer);
            var deliveredRecord = getDeliveredRecords()[0];
            expect(deliveredRecord).to.have.property('object', obj);
        });

        it('should ignore an object property  specified in the original change record', function () {
            notifier.notify({
                type: 'update',
                object : 'foo'
            });
            Object.deliverChangeRecords(observer);
            var deliveredRecord = getDeliveredRecords()[0];
            expect(deliveredRecord).to.have.property('object', obj);
        });

        it('should deliver a change record with all other property equals to the original one', function () {
            notifier.notify({
                type: 'update',
                foo : 1,
                bar : 2
            });
            Object.deliverChangeRecords(observer);
            var deliveredRecord = getDeliveredRecords()[0];
            expect(deliveredRecord).to.have.property('foo', 1);
            expect(deliveredRecord).to.have.property('bar', 2);
        });

        it('should call the observer function only once even in case of multiple observation', function () {
            Object.observe(obj, observer);
            notifier.notify({
                type: 'update',
                name: 'foo'
            });

            Object.deliverChangeRecords(observer);
            expect(observer.calledOnce).to.be.ok();
        });

        it('should not call a function that has not been used for an observation', function () {
            var observer2 = sinon.spy();
            notifier.notify({
                type: 'update',
                name: 'foo'
            });
            Object.deliverChangeRecords(observer2);
            expect(observer2.called).not.to.be.ok();
        });

        it('should not call the observer after call to Object.unobserve', function () {
            Object.unobserve(obj, observer);
            notifier.notify({
                type: 'update',
                name: 'foo'
            });
            Object.deliverChangeRecords(observer);
            expect(observer.called).not.to.be.ok();
        });

        it('should not deliver change records between an unobservation and a reobservation', function () {
            Object.unobserve(obj, observer);
            notifier.notify({
                type: 'update',
                name: 'foo'
            });
            Object.observe(obj, observer);
            notifier.notify({
                type: 'update',
                name: 'foo'
            });
            Object.deliverChangeRecords(observer);
            expect(getDeliveredRecords()).to.have.length(1);
        });


        it('should deliver records in the order of notification', function () {
            notifier.notify({
                type: 'update',
                order: 0
            });

            notifier.notify({
                type: 'update',
                order: 1
            });

            notifier.notify({
                type: 'update',
                order: 2
            });

            Object.deliverChangeRecords(observer);

            var changeRecords = getDeliveredRecords();
            expect(changeRecords[0]).to.have.property('order', 0);
            expect(changeRecords[1]).to.have.property('order', 1);
            expect(changeRecords[2]).to.have.property('order', 2);
        });


        it('should deliver change records asynchronously without a call to Object.deliverChangeRecords', function (done) {
            this.timeout(100);
            Object.observe(obj, function () {
                done();
            });
            notifier.notify({
                type: 'update'
            });
        });


        it('should deliver change records in the order of observation', function (done) {
            this.timeout(100);
            var obj2 = {},
                notifier2 = Object.getNotifier(obj2),
                observer2 = sinon.spy(function () {
                    expect(observer.called).to.be.ok();
                });

            Object.observe(obj2, observer2);

            Object.observe(obj, function () {
                expect(observer2.called).to.be.ok();
                done();
            });

            notifier.notify({
                type: 'update'
            });

            notifier2.notify({
                type: 'update'
            });
        });


        it('should only deliver change records with type in the accept list if defined', function () {
            Object.observe(obj, observer, ['bar', 'foo']);

            notifier.notify({
                type: 'update'
            });

            notifier.notify({
                type: 'foo'
            });

            notifier.notify({
                type: 'new'
            });

            notifier.notify({
                type: 'foo'
            });

            notifier.notify({
                type: 'bar'
            });

            Object.deliverChangeRecords(observer);

            expect(getDeliveredRecords()).to.be.eql([
                { object : obj, type: 'foo' },
                { object : obj, type: 'foo' },
                { object : obj, type: 'bar' }
            ]);
        });

        it('should deliver a change record with \'type\' property equals to the performChange \'changeType\' ' +
            'argument value and with properties of the returned value of the changeFunction', function () {
            notifier.performChange('update', function () { });
            notifier.performChange('delete', function () {
                return {
                    message: 'hello world'
                };
            });


            Object.deliverChangeRecords(observer);

            expect(getDeliveredRecords()).to.be.eql([
                { object : obj, type: 'update' },
                { object : obj, type: 'delete', message: 'hello world' }
            ]);
        });


        it('should only deliver first changeType passed to performChange if part of accept list during a performChange', function () {
            var notifyFoo = function () {
                notifier.performChange('foo', function () {
                    notifier.notify({type : 'reconfigure'});
                });

            }, notifyBar = function () {
                notifier.performChange('bar', function () {
                    notifier.notify({type : 'setPrototype'});
                });
            }, notifyFooAndBar = function () {
                notifier.performChange('fooAndBar', function () {
                    notifyFoo();
                    notifyBar();
                });
            }, observer2 = sinon.spy();

            Object.observe(obj, observer2, ['foo', 'bar', 'fooAndBar']);

            notifyFoo();
            notifyBar();
            notifyFooAndBar();
            Object.deliverChangeRecords(observer);
            Object.deliverChangeRecords(observer2);

            expect(getDeliveredRecords()).to.be.eql([
                { object : obj, type: 'reconfigure' },
                { object : obj, type: 'setPrototype' },
                { object : obj, type: 'reconfigure' },
                { object : obj, type: 'setPrototype' }
            ]);

            expect(observer2.args[0][0]).to.be.eql([
                { object : obj, type: 'foo' },
                { object : obj, type: 'bar' },
                { object : obj, type: 'fooAndBar' }
            ]);
        });


    });
});
