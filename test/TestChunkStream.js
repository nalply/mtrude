"use strict";

var assert = require('assert');
var fs = require('fs');
var mtrude = require('mtrude');
var ChunkStream = mtrude.rtmp.ChunkStream;

var mockSocket = require('./fixtures/Tools').mockSocket;


module.exports = {
  'test with incoming file': function() {
    var handshake = false;
    var end = false;
    var length = 0;
    var chunkIndex = 0;

    var cs = new ChunkStream(mockSocket('incoming1'));
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
      assert.equal(chunkIndex, 3, chunkIndex + ' == 3');
      end = true;
    });
    process.on('exit', function() {
      assert(handshake, 'handshake has not been emitted');
      assert(end, 'end has not been emitted');
    });
  },
}
