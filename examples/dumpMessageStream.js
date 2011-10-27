"use strict";

require('colors');
var net = require('net');
var mtrude = require('mtrude');
var rtmp = mtrude.rtmp;
var ChunkStream = rtmp.ChunkStream;
var MessageStream = rtmp.MessageStream;
var asSocket = mtrude.asSocket;

function main() {
  var optimist = require('optimist')
    .usage('Usage: $0 [--debug] [--chunks] [in [out]]')
    .boolean('debug')
    .boolean('chunks')
    .boolean('help')
    .alias('h', 'help')
    .describe('debug', 'Set MessageStream.DBG = true')
    .describe('chunks', 'Also dump chunks')
  ;
  var argv = optimist.argv;

  if (argv.help || argv._.length > 2) {
    optimist.showHelp();
    return;
  }

  console.log('Dump format:\n'
    + 'MESSAGE: ....\n');

  if (argv.debug) MessageStream.DBG = true;

  if (argv._.length == 0) {
    var server = net.createServer();
    server.on('connection', function(socket) {
      console.log('CONN : ' + 'Connection from %s'.cyan, socket.remoteAddress);
      var chunkStream = new ChunkStream();
    });
    server.listen(1935);
    console.log('LISTN: ' + 'Listening on port 1935'.cyan);
  }
  else {
    var iFile = argv._[0];
    var time36 = new Date().getTime().toString(36)
    var oFile = argv._[1] || 'out-' + time36 + '.raw';
    var chunkStream = new ChunkStream(asSocket(iFile, oFile
      , function() { console.log('FILE : ' + 'Reading %s'.cyan, iFile); }
      , function() { console.log('FILE : ' + 'Writing %s'.cyan, oFile); }
    ));
  }

  if (argv.chunks) require('./dumpChunkStream')(chunkStream);

  var messageStream = new MessageStream(chunkStream);
  dumpMessageStream(messageStream);
}

var DumpTools = require('./DumpTools');
var dump8 = DumpTools.dump8;
var hex2 = DumpTools.hex2;
var hex6 = DumpTools.hex6;
var ascii8 = DumpTools.ascii8;

function dumpMessageStream(messageStream) {
  messageStream.on('error', function(errorMessage) {
    console.log('ERROR:', ('MessageStream: ' + errorMessage).red);
    messageStream.close();
  });
  messageStream.on('warn', function(warnMessage) {
    console.log('WARN :', ('MessageStream: ' + warnMessage).red);
  });
  messageStream.on('end', function(graceful) {
    var msg = 'MessageStream ' + (graceful ? '' : 'not ') + 'gracefully ended';
    console.log('END  :', graceful ? msg.green : msg.red);
  });
  messageStream.on('message', function(message) {
    console.log('MSG  : %s %s %s %s %s:%s %s',
      dump8(message.data).blue, ascii8(message.data),
      hex6(message.timestamp).blue, hex2(message.typeid).green,
      hex6(message.csid).blue, hex6(message.msid).blue,
      message.data.length.toString().magenta);
  });
  messageStream.on('ping', function(ping) {
    var id = ping.id == null ? '-' : ping.id;
    var timestamp = ping.timestamp == null ? ping.buflen : ping.timestamp;
    console.log('PING : %s (%s) %s %s',
      hex2(ping.type).green, rtmp.pingNames[ping.type].green,
      id.toString().blue, (timestamp || '-').toString().blue);
  });
}

if (require.main === module) main();
exports.dumpMessageStream = dumpMessageStream;

