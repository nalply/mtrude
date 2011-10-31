"use strict";

var fs = require('fs');
var mtrude = require('mtrude');
var ChunkStream = mtrude.rtmp.ChunkStream;
var spawn = require('child_process').spawn;

var mockSocket = require('./fixtures').mockSocket;

function incoming(filename, chunkCount, exit, assert) {
  var handshake = false;
  var end = false;
  var length = 0;
  var chunkIndex = 0;

  var cs = new ChunkStream(mockSocket(filename));
  cs.on('error', function(errorMessage) {
    assert.ok(false, filename + ': error emitted: ' + errorMessage);
  });
  cs.on('warn', function(warnMessage) {
    assert.ok(false, filename + ': warn emitted: ' + warnMessage);
  });
  cs.on('handshake', function() { handshake = true; });
  cs.on('end', function(graceful) {
    assert.ok(graceful, filename + ': not a graceful end');
    assert.equal(chunkIndex, chunkCount,
      filename + ': ' + chunkIndex + ' == ' + chunkCount);
    end = true;
  });
  cs.on('chunk', function(chunk) {
    assert.ok(handshake, filename +
      ': handshake must be emitted before any chunks');
    chunkIndex++;
  });
  exit(function() {
    assert.ok(handshake, filename + ': handshake has not been emitted');
    assert.ok(end, filename + ': end has not been emitted');
  });
  return cs;
}

function dumpChunkStream(filename, assert) {
  var iFile = 'test/data/' + filename + '.raw';
  var tFile = 'test/data/' + filename + '-chunks.txt';
  var js = 'examples/dumpChunks.js';
  var args = [js, '--nocolor', iFile, '/dev/null'];
  var child = spawn('node', args);
  var commandText = '\n      command: node ' + args.join(' ');
  var text = '';

  child.stdout.on('data', function(data) { text += data });
  child.on('exit', function(code) {
    assert.equal(code, 0, 'child had nonzero exit code: ' + code + commandText);
    fs.readFile(tFile, function(err, testData) {
      assert.equal(err, null, err + ': ' + commandText);
      assert.equal(text, testData, js + ' <> ' + iFile + ': ' + commandText);
    });
  });
}


module.exports = {
  'test incoming1': function(exit, assert) {
    var cs = incoming('incoming1', 3, exit, assert);
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
    var cs = incoming('incoming2', 7, exit, assert);
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
    var cs = incoming('incoming3', 8, exit, assert);
  },

  'test outgoing2': function(exit, assert) {
    var cs = incoming('outgoing2', 7, exit, assert);
  },

  'test outgoing3': function(exit, assert) {
    var cs = incoming('outgoing3', 25, exit, assert);
    var chunkIndex = 0;

    cs.on('chunk', function(chunk) {
      if (chunk.typeid == 1) cs.chunkSize = chunk.data.readUInt32LE(0);
      assert.equal(chunk.csid, [2, 2, 2, 3, 3, 3, 3, 2, 2, 20, 20, 20, 20, 20,
        20, 20, 2, 21, 21, 20, 20, 2, 20, 20, 2][chunkIndex]);
      chunkIndex++;
    });
  },

  'dump incoming1': function(exit, assert) {
    dumpChunkStream('outgoing3', assert);
  },

  'dump incoming2': function(exit, assert) {
    dumpChunkStream('outgoing3', assert);
  },

  'dump outgoing2': function(exit, assert) {
    dumpChunkStream('outgoing2', assert);
  },

  'dump outgoing3': function(exit, assert) {
    dumpChunkStream('outgoing3', assert);
  },
}
