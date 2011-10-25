"use strict";

var assert = require('assert');
var fs = require('fs');
var ChunkStream = require('mtrude').rtmp.ChunkStream;

var asSocket = require('./fixtures/asSocket');


module.exports = {
  'test with incoming file': function() {
    var handshake = false;
    var end = false;
    var length = 0;
    var chunkIndex = 0;

    var outgoing = 'test/out-' + new Date().getTime().toString(36);
    var cs = new ChunkStream(asSocket('test/incoming', outgoing));
    cs.on('error', function(err) {
      assert(false, 'error emitted: ' + err);
    });
    cs.on('warn', function(message) { console.log('WARN', message); });
    cs.on('handshake', function() { handshake = true; });
    cs.on('chunk', function(chunk) {
      assert(handshake, 'handshake must be emitted first');
      assert.equal(chunk.csid, [3, 3, 2][chunkIndex]);
      assert.equal(chunk.msid, 0);
      assert.equal(chunk.typeid, [20, 20, 5][chunkIndex]);
      assert.equal(chunk.length, [235, 235, 4][chunkIndex]);
      assert.equal(chunk.rest, [107, 0, 0][chunkIndex]);
      assert.equal(chunk.data.length, [128, 107, 4][chunkIndex]);
      chunkIndex++;
    });
    cs.on('end', function(graceful) {
      assert(graceful, 'not a graceful end');
      end = true;
    });
    process.on('exit', function() {
      assert.equal(chunkIndex, 0, chunkIndex + ' == 3');
      assert(handshake, 'handshake has not been emitted');
      assert(end, 'end has not been emitted');
    });
  },
}
