"use strict";

require('colors');
var net = require('net');
var mtrude = require('mtrude');
var ChunkStream = mtrude.rtmp.ChunkStream;
var asSocket = mtrude.asSocket;

console.log(''
  + 'NOTE! ChunkStream is not complete without MessageStream and might get\n'
  + 'stuck because of missing coordination with peer. Dump format:\n'
  + 'CHUNK: %s %s %s %s %s:%s %s:%s,%s\n',
  'data-1st-8-bytes'.blue, 'ascii-8c'.yellow,
  'tstamp'.blue, 'ti'.green, 'msg-id'.blue, 'chs-id'.blue,
  'msglen'.magenta, 'chklen'.blue, 'rest'.blue
);

if (process.argv[2] == '--debug') {
  ChunkStream.DBG = true;
  process.argv.splice(2, 1);
}

if (process.argv.length == 2) {
  var server = net.createServer();
  server.on('connection', function(socket) {
    console.log('Connection from %s', socket.remoteAddress);
    dumpChunks(socket);
  });
  server.listen(1935);
  console.log('Listening on port 1935');
}
else {
  mockedChunkStream();
}

function mockedChunkStream() {
  var inFile = process.argv[2];
  var outFile = process.argv[3] ||
    'out-' + new Date().getTime().toString(36) + '.raw';
  dumpChunks(asSocket(inFile, outFile
    , function() { console.log('reading file ' + inFile); }
    , function() { console.log('writing file ' + outFile); }
  ));
}

function dumpChunks(socket) {
  var chunkStream = new ChunkStream(socket);

  chunkStream.on('error', function(message) {
    console.log(message);
    chunkStream.close();
  });
  chunkStream.on('end', function(graceful) {
    var msg = 'END  : Ended ' + (graceful ? '' : 'not ') + 'gracefully';
    console.log(graceful ? msg.green : msg.red);
  });
  chunkStream.on('handshake', function() {
    console.log('HANDS: %s'.green, 'handshake completed successfully');
  });
  chunkStream.on('warn', function(message) {
    console.log('WARN : %s'.red, message);
  });
  chunkStream.on('chunk', function(chunk) {
    console.log(
      'CHUNK: %s %s %s %s %s:%s %s:%s,%s',
      dump8(chunk.data).blue, ascii8(chunk.data),
      hex6(chunk.timestamp).blue, hex2(chunk.typeid).green,
      hex6(chunk.csid).blue, hex6(chunk.msid).blue,
      chunk.length.toString().magenta, chunk.data.length.toString().blue,
      chunk.rest.toString().blue);
    if (chunk.typeid == 1) {
      var chunkSize = chunk.data.readUInt32LE(0);
      chunkStream.warn('ChunkStreamDumper setting chunk size to ' + chunkSize);
      chunkStream.chunkSize = chunkSize;
    }
  });
}

function dump8(data) {
  function b(i) { return i < data.length ? hex2(data.readUInt8(i)) : '  '; }

  return b(0) + b(1) + b(2) + b(3) + b(4) + b(5) + b(6) + b(7);
}

function hex2(byte) {
  function hex1(nybble) { return "0123456789abcdef"[nybble & 0xf]; }
  return hex1(byte >> 4) + hex1(byte);
}

function hex6(int24) {
  return hex2(int24 >> 16) + hex2(int24 >> 8) + hex2(int24);
}

function ascii8(data) {
  function asChar(b) { return String.fromCharCode(b); }
  function ascii(b) { return b > 31 && b < 128 ? asChar(b).yellow : '·'.black; }
  function b(i) { return i < data.length ? ascii(data.readUInt8(i)) : '·'.white; }

  return b(0) + b(1) + b(2) + b(3) + b(4) + b(5) + b(6) + b(7);
}

