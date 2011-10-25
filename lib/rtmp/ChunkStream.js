"use strict";


var net = require('net');
var util = require('util');
var events = require('events');
var mtrude = require('mtrude');
var EventEmitter = events.EventEmitter;
var BufferChain = mtrude.BufferChain;
var OutgoingTools = mtrude.OutgoingTools;

function dbg() { if (ChunkStream.DBG) console.log.apply(console, arguments) }

/**
 * RTMP ChunkStream: the lowest-level possible layer of RTMP. Even the
 * protocol control message 1, Set Chunk Size (RTMCSP 7.1) is not implemented
 * here. This layer and the next layer (RTMP MessageStream) are tightly
 * coupled: MessageStream must set chunk size or mis-synchronization occurs.
 * Therefore this layer is an internal implementation detail of mtrude.
 *
 * ChunkStream emits these events:
 *   'error': function(message) {}
 *       Emitted on networking or protocol errors
 *   'warn': function(message) {}
 *       Emitted on potential problems
 *   'end' function(graceful) {}
 *       Emitted on disconnect from other end (graceful or not)
 *   'handshake' function(deltaTime) {}
 *       Emitted on succesful handshake. deltaTime is the time difference
 *       between the first and the second package from the other side.
 *   'chunk' function(chunk) {}
 *       Emitted on received chunk. chunk has the fields
 *         csid:      Chunk Stream ID
 *         timestamp: Chunk timestamp (milliseconds, increasing and wrapping)
 *         length:    Chunk length in bytes
 *         rest:      Remaining data length in bytes
 *         typeid:    Message type ID
 *         msid:      Message Stream ID
 *         data:      Chunk payload
 *
 * ChunkStream has these methods:
 *   send(chunk) send a chunk
 *   close()     close the connection
 *
 * ChunkStream has these properties:
 *   socket     can also be a bidirectional stream. socket.write() and the
 *     events 'data', 'end' and 'error' must do the 'right' things. Readonly.
 *   buffers   incoming buffer list. Readonly.
 *   chunks    metadata about chunks.
 *   chunkSize low level property of RTMSCP (6. and 7.1).
 *   state     of RTMSCP parser.
 *
 * Constructor: new ChunkStream(socket, state, init, offset)
 *   socket: socket or bidirectional stream
 *   state: starting state (default 'handshake0Server')
 *   init: initial buffer or buffer list (default empty)
 *   offset: initial offset in init (default 0)
*/
function ChunkStream(socket, state, init, offset) {
  var it = this;
  EventEmitter.call(it);

  it._socket = OutgoingTools(socket);
  it._buffers = new BufferChain(init, offset);
  it._chunks = {};
  it.chunkSize = 128;
  it.state = state || 'handshake0Server';

  it.socket.on('data',
    function(buffer) {
      var length = it.buffers.length;
      var ok = it.buffers.push(buffer);
      dbg('data :', 'data read', buffer.length, 'length',
        length, '->', it.buffers.length);

      if (ok) it._loop(); else it.error('ReadStream data: not a buffer');
    });

  it.socket.on('end',
    function() {
      it._loop();
      it.emit('end', it.state == 'chunk')
      it.state = 'dead';
    });

  it.socket.on('error', function(error) { it.error(error.message); } );

  it._loop();
}

ChunkStream.DBG = false;

util.inherits(ChunkStream, EventEmitter);


// === Prototype ==
var p = ChunkStream.prototype;

p._waitFor = function(length) {
  dbg('       waitFor() this.buffers.length', this.buffers.length,
    'length', length, 'result', this.buffers.length <= length);
  return this.buffers.length <= length;
}

p._loop = function() {
  while (true) {
    var state = this.state;
    dbg('work :', state);
    var okay = this[this.state]();
    if (okay) dbg('done :', state, '->', this.state);
    else break;
  }
}

p.error = function(errorText) {
  if (this.state == 'dead') return;

  this.emit('error', errorText);
  this.state = 'dead';
}

Object.defineProperties(p, {
  state: {
    get: function() { return this._state; },
    set: function(state) {
      if (!(state in ChunkStream.states)) this.error(
        'state ' + state + ' does not exist');

      if (this._state != 'dead') this._state = state;
    },
  },
  time: {
    get: function() { return new Date().getTime() & 0xffffffff; }
  },
  socket: {
    get: function() { return this._socket; },
  },
  buffers: {
    get: function() { return this._buffers; },
  },
  chunks: {
    get: function() { return this._chunks; },
  },
  chunkSize: {
    get: function() { return this._chunkSize; },
    set: function(chunkSize) {
      if (isNaN(chunkSize) || chunkSize < 128 || chunkSize > 65536)
        throw new Error('Illegal chunk size (RTMCSP 6.)');
      this._chunkSize = chunkSize;
    },
  }
});


// === State handlers ===

ChunkStream.states = {}
var s = ChunkStream.states;

s.handshake0Server = function() { // RTMCSP 5.2 Handshake C0, S0 and S1
  if (this._waitFor(1)) return false;

  var version = this.buffers.consumeUInt8(); // C0: RTMP version client
  this.socket.writeUInt8(3);                 // S0: RTMP version server
  this.socket.writeInt32BE(this.time);       // S1: Timestamp
  this.socket.writeInt32BE(0);               // S1: Timestamp zero
  this.socket.writeFilled(0xc5, 1528);       // S1: Random data
  this.state = 'handshake1Server';

  if (version != 3) this.emit('warn', 'RTMP version is not 3, but', version);

  return true;
}

s.handshake1Server = function() { // RTMCSP 5.3 Handshake C1 and S2
  if (this._waitFor(1536)) return false;

  var clientTime = this.buffers.consumeInt32BE();  // C1: Timestamp
  this.buffers.consumeInt32BE();                   // C1: TS zero: ignore
  var data = this.buffers.consumeBuffers(1528);    // C1: Random data
  this.socket.writeInt32BE(clientTime);            // S2: Timestamp back
  this.socket.writeInt32BE(this.time);             // S2: Timestamp 2
  this.socket.writeBuffers(data);                  // S2: C1 data back

  this.state = 'handshake2Server';
  return true;
}

s.handshake2Server = function() { // RTMCSP 5.3 Handshake C2
  if (this._waitFor(1536)) return false;

  this.buffers.consume(1536);  // C2: Timestamp back; two; data back: ignore

  // Handshake has ended. Initialize chunks and start chunking.
  this.emit('handshake');

  this.chunks.chunkCounter = 0;
  this.chunks.rests = {};           // rest lengths for each stream
  this.state = 'chunk';

  return true;
}

// 'chunk' is a good waiting and a graceful end state.
s.chunk = function() { // RTMCSP 6.1.1 Chunk Basic Header 1 (csid > 1)
  if (this._waitFor(1)) return false;

  var csid = this.buffers.consumeUInt8();
  var chunks = this.chunks;
  chunks.fmt = csid >>> 6;
  chunks.csid = csid & 0x3f;
  chunks.count = chunks.chunkCounter++;

  if (chunks.csid == 0 || chunks.csid == 1) {
    this.state = 'chunk' + chunks.csid;
  }
  else {
    this.state = 'chunkType' + chunks.fmt;
  }
  dbg('chunks', chunks);

  return true;
}

s.chunk0 = function() { // RTMCSP 6.1.1 Chunk Basic Header 2 (csid == 0)
  if (this._waitFor(1)) return false;

  this.chunks.csid = this.buffers.consumeUInt8() + 64;
  this.state = 'chunkType' + this.chunks.fmt;
  dbg('chunks', this.chunks);

  return true;
}

s.chunk1 = function() { // RTMCSP 6.1.1 Chunk Basic Header 3 (csid == 1)
  if (this._waitFor(2)) return false;

  this.chunks.csid = this.buffers.consumeUInt16BE() + 64;
  this.state = 'chunkType' + chunks.fmt;
  dbg('chunks', this.chunks);

  return true;
}

function newChunk(chunks, msid, timestamp, length, typeid, data, rest) {
  return {
    timestamp: timestamp,
    length:    length,
    typeid:    typeid,
    msid:      msid,
    csid:      chunks.csid,
    data:      data,
    rest:      rest,
  };
}

function id(chunks) { return chunks.csid + ':' + chunks.msid }

s.chunkType0 = function() { // RTMCSP 6.1.2.1 Chunk Type 0; start message
  if (this._waitFor(11)) return false;

  var chunks = this.chunks;
  chunks.timestamp = this.buffers.consumeUInt24BE();
  chunks.length = this.buffers.consumeUInt24BE();
  chunks.typeid = this.buffers.consumeUInt8();
  chunks.msid = this.buffers.consumeInt32BE();
  chunks.rests[id(chunks)] = chunks.length;

  if (chunks.timestamp === 0xffffff)
    return this.error("Extended Timestamp not supported");

  this.state = 'chunkData';
  return true;
};

s.chunkType1 = function() { // RTMCSP 6.1.2.2 Chunk Type 1; start message
  if (this._waitFor(7)) return false;                    // same msid

  var chunks = this.chunks;
  chunks.timestamp = this.buffers.consumeUInt24BE();
  chunks.length = this.buffers.consumeUInt24BE();
  chunks.typeid = this.buffers.consumeUInt8();
  chunks.rests[id(chunks)] = chunks.length;

  if (chunks.timestamp === 0xffffff)
    return this.error("Extended Timestamp not supported");

  this.state = 'chunkData';
  return true;
};

s.chunkType3 = function() { // RTMCSP 6.1.2.4 Chunk Type 3; additional chunk
  this.state = 'chunkData'; // Do nothing
  return true;
};

s.chunkData = function() { // RTMCSP 6.1 Chunk Data
  var chunks = this.chunks;
  var rest = chunks.rests[id(chunks)];
  dbg('       chunkData length', chunks.length, 'rest', rest);

  var length = Math.min(this.chunkSize, rest);
  if (this._waitFor(length)) return false;

  rest = chunks.rests[id(chunks)] -= length;

  var data = this.buffers.consumeBuffers(length);
  var chunk = newChunk(chunks, chunks.msid, chunks.timestamp, chunks.length,
    chunks.typeid, data, rest);
  this.emit('chunk', chunk);

  this.state = 'chunk';
  return true;
};

s.dead = function() {
  return this.error('ChunkStream is dead');
};


// === State handler registrator ===

for (var state in s) {
  if (ChunkStream.prototype[state] != null)
    new Error(state + ' conflicts with a prototype member of same name');

  ChunkStream.prototype[state] = s[state];
  Object.freeze(ChunkStream.prototype[state]);
}

Object.freeze(ChunkStream.states);
Object.freeze(ChunkStream.prototype);
Object.freeze(ChunkStream);

module.exports = ChunkStream;


