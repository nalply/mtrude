var asSocket = require('mtrude').asSocket;

exports.mockSocket = function(name) {
  var dir = 'test/data/';
  var outgoing = dir + 'out-' + new Date().getTime().toString(36) + '.raw';
  return asSocket(dir + name + '.raw', outgoing);
}


