"use strict"

var rtmp = require('./RTMP');
var types = rtmp.types;
var MessageStream = require('./MessageStream');
var AMF = require('./AMF');
var BufferChain = require('../BufferChain');


function Application(messageStream, callbacks) {
  var it = this;
  function bindCallback(name) {
    if (callbacks && typeof callbacks['name'] == 'function')
      it['name'] = callbacks['name'];
  }

  it._messageStream = messageStream;
  bindCallback('connect');

  it.messageStream.on('message', function(message) {
    it.handleMessage(message) });
}


var p = Application.prototype;

p.handleMessage = function(message) {
  if (message.typeid == types.INVOKE) {
    var command = AMF.deserializeZ(message.data, this.messageStream);

    if (command[0] == 'connect') {
      var ok = this.connect ? this.connect(message) : true;
      if (ok) this.messageStream.send(types.INVOKE, message.msid, message.csid,
        new Date().getTime(), AMF.serializeZ('_result', 1,
          { fmsVer: 'FMS/3,0,1,123', capabilities: 31 },
          { level: 'status', code: 'NetConnection.Connect.Success',
            description: 'Connection succeeded', objectEncoding: 3 }));
      return;
    }
  }

  if (message.typeid == rtmp.types.SERVER) {
    var windowSize = message.data.readUInt32BE(0);
    var timestamp = new Date().getTime();
    messageStream.send(rtmp.types.SERVER, message.msid, message.csid,
      timestamp, message.data);

    var buffer = new Buffer(5);
    messageStream.copy(buffer);
    buffer[4] = 2;
    messageStream.send(rtmp.types.BANDWIDTH, message.msid, message.csid,
      timestamp, buffer);
  }
}

Object.defineProperties(p, {
  messageStream: {
    get: function() { return this._messageStream; },
  },
});

module.exports = Application

