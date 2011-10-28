"use strict";

require('colors');
var util = require('util');
var net = require('net');
var mtrude = require('mtrude');
var rtmp = mtrude.rtmp;
var ChunkStream = rtmp.ChunkStream;
var MessageStream = rtmp.MessageStream;
var AMF = rtmp.AMF;
var asSocket = mtrude.asSocket;
var dumpTools = require('./dumpTools');

function main() {
  var optimist = require('optimist')
  .usage('Usage: $0 [--debug] [--messages] [--nocolor] [--ignore] [in [out]]')
    .boolean('debug')
    .boolean('nocolor')
    .boolean('messages')
    .boolean('ignore')
    .boolean('help')
    .alias('h', 'help')
    .describe('debug', 'Set MessageStream.DBG = true')
    .describe('messages', 'Also dump messages')
    .describe('nocolor', 'Don\'t use colors')
    .describe('ignore', 'Ignore errors')
  ;
  var argv = optimist.argv;

  if (argv.help || argv._.length > 2) {
  var messageStream = new MessageStream(chunkStream);
  if (argv.messages) require('./dumpMessageStream')(messageStream);
  dumpAmf(messageStream);
    optimist.showHelp();
    return;
  }

  if (argv.nocolor) dumpTools.dontColor();

  if (argv.debug) MessageStream.DBG = true;

  if (argv._.length == 0) {
    var server = net.createServer();
    server.on('connection', function(socket) {
      console.log('CONN : ' + 'Connection from %s'.grey, socket.remoteAddress);
      var chunkStream = new ChunkStream();
    });
    server.listen(1935);
    console.log('LISTN: ' + 'Listening on port 1935'.grey);
  }
  else {
    var iFile = argv._[0];
    var time36 = new Date().getTime().toString(36)
    var oFile = argv._[1] || 'out-' + time36 + '.raw';
    var chunkStream = new ChunkStream(asSocket(iFile, oFile
      , function() { console.log('FILE : ' + 'Reading %s'.grey, iFile); }
      , function() { console.log('FILE : ' + 'Writing %s'.grey, oFile); }
    ));
  }

  var chain = new mtrude.BufferChain();
  var messageStream = new MessageStream(chunkStream);
  if (argv.messages) require('./dumpMessageStream')(messageStream);
  dumpAmf(messageStream, argv.ignore);
}

function dumpZ(buffer, messageStream) {
  return util.inspect(AMF.deserializeZ(buffer, messageStream));
}

function dump3(buffer, messageStream) {
  return util.inspect(AMF.deserialize3(buffer, messageStream));
}

function dumpAmf(messageStream, ignoreErrors) {
  messageStream.on('error', function(msg) {
    console.log('ERROR: %s', msg.red);
    if (!ignoreErrors) messageStream.close();
  });
  messageStream.on('warn', function(msg) {
    console.log('WARN : %s', msg.magenta);
    if (!ignoreErrors) messageStream.close();
  });
  messageStream.on('end', function(graceful) {
    var msg = 'dumpAmf MessageStream ' + (graceful ? '' : 'not ')
      + 'gracefully ended';
    console.log('END  :', graceful ? msg.green : msg.red);
  });
  messageStream.on('message', function(message) {
    switch (message.typeid) {
      case rtmp.types.INVOKE:
        console.log('INVOK: %s', dumpZ(message.data, messageStream).magenta);
        break;
      case rtmp.types.SO:
        console.log('SHOBJ: %s', dumpZ(message.data, messageStream).blue);
        break;
      case rtmp.types.NOTIFY:
        console.log('NOTIF: %s', dumpZ(message.data, messageStream).blue);
        break;
      case rtmp.types.FLEX:
        console.log('FLEX : %s', dump3(message.data, messageStream).cyan);
        break;
    }
  });
}

if (require.main === module) main();
exports.dumpAmf = dumpAmf;

