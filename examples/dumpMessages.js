"use strict";

require('colors');
var net = require('net');
var mtrude = require('mtrude');
var rtmp = mtrude.rtmp;
var ChunkStream = rtmp.ChunkStream;
var MessageStream = rtmp.MessageStream;
var utils = mtrude.utils;
var asSocket = utils.asSocket;

function main() {
  var optimist = require('optimist')
  .usage('Usage: $0 [--debug] [--chunks] [--nocolor] [in [out]]')
    .boolean('debug')
    .boolean('chunks')
    .boolean('nocolor')
    .boolean('help')
    .alias('h', 'help')
    .describe('debug', 'Set MessageStream.DBG = true')
    .describe('chunks', 'Also dump chunks')
    .describe('nocolor', 'Don\'t use colors')
  ;
  var argv = optimist.argv;

  if (argv.help || argv._.length > 2) {
    optimist.showHelp();
    return;
  }

  if (argv.nocolor) utils.dontColor();

  // todo PING shoulg also dump ti (it's always the same but it is nice to show
  // that).

  console.log('Dump format:\n'
    + 'MSG  : %s %s %s %s %s:%s %s\n'
    + 'PING : %s (%s) %s %s%s%s:%s\n',
    'data-1st -8-bytes'.blue, 'asci i-8c'.yellow,
    'tstamp'.blue, 'ti'.green, 'msg-id'.blue, 'chs-id'.blue, 'msglen'.magenta,
    'ty'.green, 'PING-TYPE'.green, 'id'.blue, 'ms'.grey, '                  ',
    'msg-id'.blue, 'chs-id'.blue
    );

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

var dump8 = utils.dump8;
var hex2 = utils.hex2;
var hex6 = utils.hex6;
var ascii8 = utils.ascii8;

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
  messageStream.on('control', function(control) {
    console.log('CNTRL: %s %s %s %s %s:%s %s',
      dump8(control.data).blue, ascii8(control.data),
      hex6(control.timestamp).blue, hex2(control.typeid).green,
      hex6(control.csid).blue, hex6(control.msid).blue,
      control.data.length.toString().magenta);
  });
  messageStream.on('ping', function(ping) {
    var id = (ping.id == null ? '-' : ping.id).toString();
    var timestamp = ping.timestamp == null ? ping.buflen : ping.timestamp;
    timestamp = (timestamp || '-').toString();
    var pingName = rtmp.pingNames[ping.type];
    console.log('PING : %s (%s) %s %s           %s%s:%s',
      hex2(ping.type).green, pingName.green,
      id.toString().blue, timestamp.grey,
      times(' ', 20 - pingName.length - timestamp.length - id.length),
      hex6(ping.csid).blue, hex6(ping.msid).blue);
  });
}

function times(s, n) {
  var result = '';
  for (var i = 0; i < n; i++) result += s;
  return result;
}

if (require.main === module) main();
exports.dumpMessageStream = dumpMessageStream;

