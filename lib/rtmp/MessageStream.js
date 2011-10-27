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
 *     Emitted on networking or protocol errors
 *   'warn': function(message) {}
 *     Emitted on potential problems
 *   'end' function(graceful) {}
 *     Emitted on disconnect from other end (graceful or not)
 *   'message' function(message) {}
 *     Emitted on received complete message. message has the fields
 *       csid:      Chunk Stream ID
 *       msid:      Message Stream ID
 *       timestamp: Message timestamp (milliseconds, increasing and wrapping)
 *       typeid:    Message type ID
 *       data:      Message payload
 *   'ping' function(ping) {}
 *     Emitted on ping messages (User control message). ping has the fields
 *       type:      One of the fields of rtmp.pings
 *       id:        Stream ID the ping is about (for BEGIN to RECORD)
 *       timestamp: The timestamp (for PING and PONG)
 *       buflen:    The buffer length in ms (for BUFLEN)
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

MessageStream.DBG = false;

// === Prototype ==
var p = MessageStream.prototype;

p.handleChunk = function(chunk) {
  var chunks = this.chunks;
  var typeid = chunk.typeid
  var msid = chunk.msid;
  var csid = chunk.csid;
  var continuing = ' Continuing anyway.';

  if (rtmp.isControl(typeid)) {
    if (csid != 2) this.warn('Control message ' + rtmp.typeNames[typeid]
      + ' with csid=' + csid + ' != 2.' + continuing);
    this.controlProtocol(chunk);
    return;
  }

  if (!(typeid in rtmp.typeNames)) {
    this.warn('Unsupported typeid #' + typeid + '. Ignoring this message.');
    return;
  }

  if (csid == 2) this.warn('Non-control message '
    + (rtmp.typeNames[typeid] || '#' + typeid) + ' with csid=2.' + continuing);

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

p.handlePing = function(chunk) {
  function tooShort(len) {
    if (data && data.length >= len) return false;
    it.warn('Ping request with not enough data. Ignored.');
    return true;
  }
  function emit(ping) { it.emit('ping', ping); }

  var it = this;
  var data = chunk.data;

  if (tooShort(2)) return;

  var type = data.readUInt16BE(0);
  var pings = rtmp.pings;
  var ping = { type: type, csid: chunk.csid, msid: chunk.msid };
  switch (type) {
    case pings.BEGIN:
    case pings.EOF:
    case pings.DRY:
    case pings.RECORDED:
      if (tooShort(6)) return;
      ping.id = data.readUInt32BE(2);
      emit(ping);
      break;
    case pings.PING:
    case pings.PONG:
      if (tooShort(6)) return;
      ping.timestamp = data.readUInt32BE(2);
      emit(ping);
      break;
    case pings.BUFLEN:
      if (tooShort(10)) return;
      ping.id = data.readUInt32BE(2);
      ping.buflen = data.readUInt32BE(6);
      emit(ping);
      break;
    default:
      it.warn('Unknown ping request with type #' + ping.type + '. Ignored.');
      break;
  }
}

p.controlProtocol = function(chunk) {
  function tooShort(len) {
    if (chunk.data && chunk.data.length >= len) return false;
    it.warn('Protocol Control request with not enough data. Ignored.');
    return true;
  }

  var types = rtmp.types;
  switch (chunk.typeid) {
    case types.CHUNK_SIZE:
      if (tooShort(4)) return;
      this.chunkStream.chunkSize = chunk.data.readUInt32LE(0);
      break;
    case types.ABORT:
      this.warn('ABORT Protocol Control received. Closing ChunkStream.');
      this.chunkStream.close();
      break;
    case types.PING:
      this.handlePing(chunk);
      break;
    case types.ACK:
    case types.SERVER:
    case types.BANDWIDTH:
      this.emit('control', chunk);
      break;
    default: this.error('Unexpected Protocol Control Message #' + chunk.typeid
      + ' (internal error, should not have happened)');
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
Object.seal(MessageStream);

module.exports = MessageStream;

