/* @flow */

class Y { //eslint-disable-line no-unused-vars
  constructor (opts) {
    this.connector = new Y[opts.connector.name](opts.connector);
    this.db = new Y[opts.db.name](this, opts.db);
  }
  transact (generator) {
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
