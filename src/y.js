/* @flow */

const GeneratorFunction = (function*(){}).constructor;

class Y { //eslint-disable-line no-unused-vars
  constructor (opts) {
    this.db = new Y[opts.db.name](this, opts.db);
    this.connector = new Y[opts.connector.name](this, opts.connector);
    this.db.requestTransaction(function*(){
      // create initial Map type
      yield* this.addOperation({
        id: ["_", 0],
        struct: "Map",
        map: {}
      });
    });
  }
  transact (generator) {
    if (generator.constructor !== GeneratorFunction) {
      throw new Error("y.transact requires a Generator function! E.g. function*(){/*..*/}");
    }
    this.db.requestTransaction(generator);
  }
  destroy () {
    this.connector.disconnect();
    this.db.removeDatabase();
    this.connector = null;
    this.db = null;
    this.transact = function(){
      throw new Error("Remember?, you destroyed this type ;)");
    };
  }
}
