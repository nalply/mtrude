require('colors');
var net = require('net');
var ChunkStream = require('mtrude').rtmp.ChunkStream;

var server = net.createServer();
server.on('connection', function(socket) {
  console.log('Connection from %s', socket.remoteAddress);
  var chunkStream = new ChunkStream(socket);

  chunkStream.on('error', function(exception) {
    console.log(exception.stack);
    server.close();
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
});

server.listen(1935);
console.log();
console.log('Listening on port 1935');
console.log(''
  + 'Note: ChunkStream is not complete without MessageStream and might not\n'
  + 'always work correctly (for example mis-synchronization due to a missing\n'
  + 'implementation of "Set Chunk Size" (RTMP Message Formats 5.1).\n'
  + 'Consider using MessageStreamDumper.js instead.'
);


