"use strict";

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
  var colors = 'cyan yellow blue grey white magenta red green'.split(' ');
  for (var i in colors)
  Object.defineProperty(String.prototype, colors[i],
      { get: function() { return this } });
}
