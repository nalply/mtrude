var asSocket = require('mtrude').utils.asSocket;
var fs = require('fs');

exports.mockSocket = function(name, assert) {
  // This function should not be called as a unit test.
  // I would have preferred Expresso to test only functions starting with
  // 'test' or to have an option to exclude functions from testing.
  if (assert && assert.name == 'ok') return;

  var dir = 'test/data/';
  var incoming = dir + name + '.raw';
  var outgoing = dir + 'out-' + new Date().getTime().toString(36) + '.raw';
  return asSocket(incoming, outgoing
    , function() { /* console.log('mockSocket(): reading ' + incoming); */ }
    , function() { fs.unlink(outgoing); }
  );
}


