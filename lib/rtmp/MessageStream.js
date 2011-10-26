"use strict";

var util = require('util');
var events = require('events');
var mtrude = require('mtrude');
var rtmp = mtrude.rtmp;
var ChunkStream = rtmp.ChunkStream;
var BufferChain = mtrude.BufferChain;
var EventEmitter = events.EventEmitter;

function dbg() {
  if (MessageStream.DBG) console.log.apply(console, arguments);
}

/**
 * RTMP MessageStream: a low-level data-agnostic layer of RTMP. MessageStream
 * delivers a stream of messages with the event 'message'. Also a message can
 * be sent. In both cases chunking and de-chunking is done by MessageStream
 * and ChunkStream in tandem.
 *
 * MessageStream emits these events:
 *   'error': function(message) {}
 *       Emitted on networking or protocol errors
 *   'warn': function(message) {}
 *       Emitted on potential problems
 *   'end' function(graceful) {}
 *       Emitted on disconnect from other end (graceful or not)
 *   'message' function(message) {}
 *       Emitted on received complete message. message has the fields
 *         csid:      Chunk Stream ID
 *         msid:      Message Stream ID
 *         timestamp: Message timestamp (milliseconds, increasing and wrapping)
 *         typeid:    Message type ID
 *         data:      Message payload
 *
 * MessageStream has these methods:
 *   send(message) send a message
 *   close()       close the connection
 *
 * MessageStream has these properties
 *   chunkStream the underlying chunk stream. Readonly.
 *
*/
function MessageStream(chunkStream) {
  var it = this;
  EventEmitter.call(it);

  it._chunkStream = chunkStream;
  it._chunks = [];

  it.chunkStream.on('chunk', function(chunk) { it.handleChunk(chunk); });
  it.chunkStream.on('error', function(message) { it.error(message); });
  it.chunkStream.on('end', function(graceful) { it.emit('end', graceful) });
  it.chunkStream.on('warn', function(msg) { it.warn('ChunkStream: ' + msg); });
};

util.inherits(MessageStream, EventEmitter);



// === Prototype ==
var p = MessageStream.prototype;

p.handleChunk = function(chunk) {
  var chunks = this.chunks;
  var typeid = chunk.typeid
  var msid = chunk.msid;
  var csid = chunk.csid;

  if (csid == 2 || rtmp.isControl(typeid)) {
    if (csid == 2 && rtmp.isControl(typeid)) this.controlProtocol(chunk);
    else this.error(util.format(
      'MessageStream: invalid message csid=%s msid=%s typeid=%s',
      csid, msid, typeid));

    return;
  }

  if (!chunks[csid]) chunks[csid] = [];
  if (!chunks[csid][msid]) chunks[csid][msid] = [];
  chunks[csid][msid].push(chunk);

  if (chunk.rest == 0) {
    var chunkChain = chunks[csid][msid];
    var data = new BufferChain();
    for (var i in chunkChain) { data.push(chunkChain[i].data); }
    chunks[csid][msid] = [];
    this.emit('message', {
      timestamp: chunk.timestamp,
      typeid:    typeid,
      msid:      msid,
      csid:      csid,
      data:      data,
    });
  }
}

p.controlProtocol = function(chunk) {
  switch (chunk.typeid) {
    case rtmp.CHUNK_SIZE:
      this.chunkStream.chunkSize = chunk.data.readInt32BE(0);
      break;
    case rtmp.SERVER:
      this.chunkStream.send(chunk);
      break;
    default: this.error('Protocol Control Message #' + chunk.typeid
      + ' not implemented');
  }
}

p.error = function(errorText) {
  if (this.chunkStream.state == 'dead') return;

  this.emit('error', errorText);
  this.close();
}

p.warn = function(warnText) { this.emit('warn', warnText); }

p.close = function() {
  this.chunkStream.close();
}

Object.defineProperties(p, {
  chunkStream: {
    get: function() { return this._chunkStream; },
  },
  chunks: {
    get: function() { return this._chunks; },
  },
});

Object.freeze(MessageStream.prototype);
Object.freeze(MessageStream);

module.exports = MessageStream;

