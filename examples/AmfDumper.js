require('colors');
var net = require('net');
var mtrude = require('mtrude');
var ChunkStream = mtrude.rtmp.ChunkStream;
var MessageStream = mtrude.rtmp.MessageStream;
var AMF = mtrude.rtmp.AMF;

var server = net.createServer();
server.on('connection', function(socket) {
  console.log('Connection from %s', socket.remoteAddress);
  var messageStream = new MessageStream(new ChunkStream(socket));

  messageStream.on('error', function(exception) {
    console.log(exception.stack);
    server.close();
  });
  messageStream.on('end', function(graceful) {
    console.log('END  :', 'Ended', (graceful ? '' : 'not ') + 'gracefully');
  });
  messageStream.on('message', function(message) {
    console.log(
      'MESSAGE: %s:%s typeid=%s data=%s'.blue, message.csid,
      message.msid, message.typeid, message.data.length);
    if (message.typeid == 20) {
      console.log('INVOKE'.red, AMF.deserialize(message.data));
    }
  });
});

server.listen(1935);
console.log();
console.log('Listening on port 1935');

