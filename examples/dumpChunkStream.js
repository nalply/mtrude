"use strict";

require('colors');
var net = require('net');
var mtrude = require('mtrude');
var ChunkStream = mtrude.rtmp.ChunkStream;
var asSocket = mtrude.asSocket;

function main() {
  var optimist = require('optimist')
    .usage('Usage: $0 [--debug] [--debugchain] [in [out]]')
    .boolean('debug')
    .boolean('debugchain')
    .boolean('help')
    .alias('h', 'help')
    .describe('debug', 'Set ChunkStream.DBG = true')
    .describe('debugchain', 'Set BufferChain.DBG = true')
  ;
  var argv = optimist.argv;

  if (argv.help || argv._.length > 2) {
    optimist.showHelp();
    return;
  }

  console.log(''
    + 'NOTE! ChunkStream is not complete without MessageStream and might get\n'
    + 'stuck because of missing coordination with peer. Dump format:\n'
    + 'CHUNK: %s %s %s %s %s:%s %s:%s,%s\n',
    'data-1st -8-bytes'.blue, 'asci i-8c'.yellow,
    'tstamp'.blue, 'ti'.green, 'msg-id'.blue, 'chs-id'.blue,
    'msglen'.magenta, 'chklen'.blue, 'rest'.blue
  );

  if (argv.debug) ChunkStream.DBG = true;

  if (argv.chain) mtrude.BufferChain.DBG = true;

  if (argv._.length == 0) {
    var server = net.createServer();
    server.on('connection', function(socket) {
      console.log('CONN : ' + 'Connection from %s'.cyan, socket.remoteAddress);
      dumpChunkStream(new ChunkStream(socket));
    });
    server.listen(1935);
    console.log('LISTN: ' + 'Listening on port 1935'.cyan);
  }
  else {
    var iFile = argv._[0];
    var time36 = new Date().getTime().toString(36)
    var oFile = argv._[1] || 'out-' + time36 + '.raw';
    dumpChunkStream(new ChunkStream(asSocket(iFile, oFile
      , function() { console.log('FILE : ' + 'Reading %s'.cyan, iFile); }
      , function() { console.log('FILE : ' + 'Writing %s'.cyan, oFile); }
    )));
  }
}


var DumpTools = require('./DumpTools');
var dump8 = DumpTools.dump8;
var hex2 = DumpTools.hex2;
var hex6 = DumpTools.hex6;
var ascii8 = DumpTools.ascii8;

var dumpChunkStream = function(chunkStream) {
  chunkStream.on('error', function(errorMessage) {
    console.log('ERROR:',  ('ChunkStream: ' + errorMessage).red);
    chunkStream.close();
  });
  chunkStream.on('end', function(graceful) {
    var msg = 'ChunkStream ' + (graceful ? '' : 'not ') + 'gracefully ended';
    console.log('END  :', graceful ? msg.green : msg.red);
  });
  chunkStream.on('handshake', function() {
    console.log('HANDS: %s', 'Handshake completed successfully'.green);
  });
  chunkStream.on('warn', function(message) {
    console.log('WARN : %s', ('ChunkStream: ' + message).red);
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
      chunkStream.warn('Setting chunk size to ' + chunkSize);
      chunkStream.chunkSize = chunkSize;
    }
  });
}

if (require.main === module) main();
module.exports = dumpChunkStream;
