"use strict";

var assert = require('assert');
var fs = require('fs');
var mtrude = require('mtrude');
var ChunkStream = mtrude.rtmp.ChunkStream;

var mockSocket = require('./fixtures').mockSocket;

function fix(assert) {
  for (var key in assert) assert.ok[key] = assert[key];
  return assert.ok;
}

function incoming(filename, chunkCount, exit) {
  var handshake = false;
  var end = false;
  var length = 0;
  var chunkIndex = 0;

  var cs = new ChunkStream(mockSocket(filename));
  cs.on('error', function(err) {
    assert(false, filename + ': error emitted: ' + err);
  });
  cs.on('warn', function(message) { console.log('WARN', message); });
  cs.on('handshake', function() { handshake = true; });
  cs.on('end', function(graceful) {
    assert(graceful, filename + ': not a graceful end');
    assert.equal(chunkIndex, chunkCount,
      filename + ': ' + chunkIndex + ' == ' + chunkCount);
    end = true;
  });
  cs.on('chunk', function(chunk) {
    assert(handshake, filename +
      ': handshake must be emitted before any chunks');
    chunkIndex++;
  });
  exit(function() {
    assert(handshake, filename + ': handshake has not been emitted');
    assert(end, filename + ': end has not been emitted');
  });
  return cs;
}

module.exports = {
  'test incoming1': function(exit, assert) {
    assert = fix(assert);

    var cs = incoming('incoming1', 3, exit);
    var chunkIndex = 0;

    cs.on('chunk', function(chunk) {
      assert.equal(chunk.csid, [3, 3, 2][chunkIndex]);
      assert.equal(chunk.msid, 0);
      assert.equal(chunk.typeid, [20, 20, 5][chunkIndex]);
      assert.equal(chunk.length, [235, 235, 4][chunkIndex]);
      assert.equal(chunk.rest, [107, 0, 0][chunkIndex]);
      assert.equal(chunk.data.length, [128, 107, 4][chunkIndex]);
      chunkIndex++;
    });
  },

  'test incoming2': function(exit, assert) {
    assert = fix(assert);

    var cs = incoming('incoming2', 7, exit);
    var chunkIndex = 0;

    cs.on('chunk', function(chunk) {
      assert.equal(chunk.csid, [3, 3, 2, 3, 2, 2, 8][chunkIndex]);
      assert.equal(chunk.msid, [0, 0, 0, 0, 0, 0, 16777216][chunkIndex]);
      assert.equal(chunk.typeid, [20, 20, 5, 17, 4, 4, 17][chunkIndex]);
      assert.equal(chunk.length, [235, 235, 4, 26, 10, 10, 43][chunkIndex]);
      assert.equal(chunk.rest, [107, 0, 0, 0, 0, 0, 0][chunkIndex]);
      assert.equal(chunk.data.length, [128, 107, 4, 26, 10, 10, 43][chunkIndex]);
      chunkIndex++;
    });
  },

  'test incoming3': function(exit, assert) {
    assert = fix(assert);
    var cs = incoming('incoming3', 8, exit);
  },

  'test outgoing2': function(exit, assert) {
    assert = fix(assert);
    var cs = incoming('outgoing2', 7, exit);
  },

  // Implement ChunkStream.chunkType2
  /*
  'test outgoing3': function(exit, assert) {
    assert = fix(assert);
    var cs = incoming('outgoing3', 7, exit);
  },
  */
}
