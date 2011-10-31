"use strict";

var net = require('net');
var mtrude = require('mtrude');
var rtmp = mtrude.rtmp;
var AMF = rtmp.AMF;
var ChunkStream = rtmp.ChunkStream;
var MessageStream = rtmp.MessageStream;
var Application = rtmp.Application;
var utils = mtrude.utils;


function workWithChunkStream(chunkStream) {
  var messageStream = new MessageStream(chunkStream);
  var application = new Application(messageStream, {
    connect: function(command) {
      console.log('NetConnection.connect(): ', command[2]);
      return true;
    },
  });
}

function main() {
  var optimist = require('optimist')
  .usage('Usage: $0 [--debugamf] [--debugmessage] [in [out]]')
    .boolean('debugamf')
    .boolean('debugmessage')
    .boolean('help')
    .alias('h', 'help')
    .describe('debugamf', 'Set AMF.DBG = true')
    .describe('debugmessage', 'Set MessageStream.DBG = true')
    .describe('nocolor', 'Don\'t use colors')
  ;
  var argv = optimist.argv;

  if (argv.help || argv._.length > 2) {
    optimist.showHelp();
    return;
  }

  MessageStream.DBG = !!argv.debugmessage;
  AMF.DBG = !!argv.debugamf;

  if (argv._.length == 0) {
    var server = net.createServer();
    server.on('connection', function(socket) {
      console.log('CONN : ' + 'Connection from %s', socket.remoteAddress);
      workWithChunkStream(new ChunkStream(socket));
    });
    server.listen(1935);
    console.log('LISTN: Listening on port 1935');
  }
  else {
    var iFile = argv._[0];
    var time36 = new Date().getTime().toString(36)
    var oFile = argv._[1] || 'out-' + time36 + '.raw';
    var chunkStream = new ChunkStream(utils.asSocket(iFile, oFile
      , function() { console.log('FILE : ' + 'Reading %s', iFile); }
      , function() { console.log('FILE : ' + 'Writing %s', oFile); }
    ));

    workWithChunkSteram(chunkStream);
  }
}

if (require.main === module) main();

