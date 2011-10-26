require('colors');
var net = require('net');
var mtrude = require('mtrude');
var ChunkStream = mtrude.rtmp.ChunkStream;
var MessageStream = mtrude.rtmp.MessageStream;
var asSocket = mtrude.asSocket;

console.log();

if (process.argv[2] == '--debug') {
  MessageStream.DBG = true;
  process.argv.splice(2, 1);
}

if (process.argv.length == 2) {
  var server = net.createServer();
  server.on('connection', function(socket) {
    console.log('Connection from %s', socket.remoteAddress);
    dumpMessages(socket);
  });
  server.listen(1935);
  console.log('Listening on port 1935');
}
else {
  mockedMessageStream();
}

function mockedMessageStream() {
  var inFile = process.argv[2];
  var outFile = process.argv[3] ||
    'out-' + new Date().getTime().toString(36) + '.raw';
  dumpMessages(asSocket(inFile, outFile
    , function() { console.log('reading file ' + inFile); }
    , function() { console.log('writing file ' + outFile); }
  ));
}


function dumpMessages(socket) {
  var messageStream = new MessageStream(new ChunkStream(socket));

  messageStream.on('error', function(exception) {
    console.log(exception.stack);
    messageStream.close();
  });
  messageStream.on('end', function(graceful) {
    console.log('END  :', 'Ended', (graceful ? '' : 'not ') + 'gracefully');
  });
  messageStream.on('message', function(message) {
    console.log(
      'MESSAGE: %s:%s typeid=%s data=%s'.blue, message.csid,
      message.msid, message.typeid, message.data.length);
  });
}

