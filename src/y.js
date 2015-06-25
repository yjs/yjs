/* @flow */

function Y (opts) { //eslint-disable-line no-unused-vars
  var connector = opts.connector;
  Y.Connectors[connector.name]();
}
