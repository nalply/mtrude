"use strict";
var assert = require('assert');
var BufferChain = require('./BufferChain');

module.exports = function(socket) {
  socket.writeUInt8 = function(uint8) {
    socket.write(new Buffer([uint8]));
  };

  socket.writeInt32BE = function(int32) {
    var buffer = new Buffer(4);
    buffer.writeInt32BE(int32, 0);
    socket.write(buffer);
  }

  socket.writeBuffers = function(buffers) {
    if (buffers instanceof Buffer) buffers = [buffers];
    else if (buffers instanceof BufferChain) buffers = buffers.buffers;
    else assert(false, 'buffers is neither a Buffer nor an BufferChain');

    for (var i in buffers) { socket.write(buffers[i]) }
  };

  socket.writeFilled = function(fill, length) {
    var buffer = new Buffer(length);
    buffer.fill(fill);
    this.write(buffer);
  };

  return socket;
};
