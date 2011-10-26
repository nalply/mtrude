"use strict";

require('colors');
var net = require('net');
var mtrude = require('mtrude');
var ChunkStream = mtrude.rtmp.ChunkStream;
var asSocket = mtrude.asSocket;

console.log(''
  + 'Note: ChunkStream is not complete without MessageStream and might not\n'
  + 'always work correctly (for example mis-synchronization due to a missing\n'
  + 'implementation of "Set Chunk Size" (RTMP Message Formats 5.1).\n'
  + 'Consider using MessageStreamDumper.js instead.\n'
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
    console.log('END  :', 'Ended', (graceful ? '' : 'not ') + 'gracefully');
  });
  chunkStream.on('handshake', function() {
    console.log('HANDS: %s'.green, 'handshake completed successfully');
  });
  chunkStream.on('warn', function(message) {
    console.log('WARN : %s'.red, message);
  });
  chunkStream.on('chunk', function(chunk) {
    console.log(
      'CHUNK: %s:%s typeid=%s chunk=%s data=%s rest=%s'.blue, chunk.csid,
      chunk.msid, chunk.typeid, chunk.length, chunk.data.length, chunk.rest);
  });
}



