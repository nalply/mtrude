"use strict";

var fs = require('fs');

var asSocket = exports.asSocket = function(incoming, outgoing, icb, ocb) {
  var iStream = new fs.createReadStream(incoming);
  if (typeof icb == 'function') iStream.once('open', function() { icb(); });
  var oStream = new fs.createWriteStream(outgoing);
  if (typeof ocb == 'function') oStream.once('open', function() { ocb(); });

  // Todo define as property
  iStream.writable = oStream.writable;

  function bind(bindee) { iStream[bindee] = oStream[bindee].bind(oStream); }
  bind('write');
  bind('end');

  function fan(fanee) {
    var originalFunction = iStream[fanee];
    iStream[fanee] = function() {
      originalFunction.apply(iStream, arguments);
      oStream[fanee].apply(oStream, arguments);
    }
  }
  fan('addListener');
  fan('on');
  fan('once');
  fan('removeListener');
  fan('removeAllListeners');
  fan('setMaxListeners');
  fan('destroy');
  fan('destroySoon');

  return iStream;
}

var dump8 = exports.dump8 = function(data) {
  function b(i) { return i < data.length ? hex2(data.readUInt8(i)) : '  '; }

  return b(0) + b(1) + b(2) + b(3) + ' ' + b(4) + b(5) + b(6) + b(7);
}

var hex2 = exports.hex2 = function(byte) {
  function hex1(nybble) { return "0123456789abcdef"[nybble & 0xf]; }
  return hex1(byte >> 4) + hex1(byte);
}

var hex6 = exports.hex6 = function(int24) {
  return hex2(int24 >> 16) + hex2(int24 >> 8) + hex2(int24);
}

var ascii8 = exports.ascii8 = function(data) {
  function asChar(b) { return String.fromCharCode(b); }
  function ascii(b) { return b > 31 && b < 128 ? asChar(b).yellow : '·'.black; }
  function b(i) { return i < data.length ? ascii(data.readUInt8(i)) : '·'.white; }

  return b(0) + b(1) + b(2) + b(3) + ' ' + b(4) + b(5) + b(6) + b(7);
}

var dontColor = exports.dontColor = function() {
  var colors = 'cyan yellow blue grey white magenta red green black'.split(' ');
  for (var i in colors)
    Object.defineProperty(String.prototype, colors[i],
      { get: function() { return this } });
}

