"use strict";

var assert = require('assert');
var fs = require('fs');
var ChunkStream = require('mtrude').rtmp.ChunkStream;
var MessageStream = require('mtrude').rtmp.MessageStream;

var asSocket = require('./fixtures/asSocket');


module.exports = {
  'test with incoming file': function() {
    var end = false;
    var messageIndex = 0;

    var outgoing = 'test/out-' + new Date().getTime().toString(36);
    var ms = new MessageStream(new ChunkStream(
      asSocket('test/incoming', outgoing)));
    ms.on('error', function(err) {
      assert(false, 'error emitted: ' + err);
    });
    ms.on('warn', function(message) { console.log('WARN', message); });
    ms.on('message', function(message) {
      assert.equal(message.csid, [3][messageIndex]);
      assert.equal(message.msid, 0);
      assert.equal(message.typeid, [20][messageIndex]);
      assert.equal(message.data.length, [235][messageIndex]);
      messageIndex++;
    });
    ms.on('end', function(graceful) {
      assert(graceful, 'not a graceful end');
      end = true;
    });
    process.on('exit', function() {
      console.log('process.onExit');
      assert.equal(messageIndex, 0, messageIndex + ' == 1');
      assert(end, 'end has not been emitted');
    });
  },
}
