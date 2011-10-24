"use strict";

function dbg() {
  if (BufferChain.DBG) console.log.apply(console, arguments);
}


/** Work with data in multiple buffers, but don't copy.
  * - Consume (i.e. read and throw away)
  * - Push incoming buffers
*/
var BufferChain = module.exports = function(buffer, offset) {
  this.buffers = [];
  this._offset = +offset || 0;
  this._length = 0;
  this.push(buffer);

  Object.seal(this);
}

BufferChain.prototype = {

push: function(buffer) {
  if (buffer instanceof Buffer) {
    this.buffers.push(buffer);
    this._length += buffer.length;
    return true;
  }
  else {
    return false;
  }
},

consumeUInt8: function() {
  var value = this.buffers[0][this._offset];
  this.consume(1);
  return value;
},

consumeInt32BE: function() {
  var b0 = this.consumeUInt8();
  var b1 = this.consumeUInt8();
  var b2 = this.consumeUInt8();
  var b3 = this.consumeUInt8();

  return b0 << 24 | b1 << 16 | b2 << 8 | b3;
},

consumeUInt24BE: function() {
  var b0 = this.consumeUInt8();
  var b1 = this.consumeUInt8();
  var b2 = this.consumeUInt8();

  return b0 << 16 | b1 << 8 | b2;
},

consumeUInt16BE: function() {
  var b0 = this.consumeUInt8();
  var b1 = this.consumeUInt8();

  return b0 << 8 | b1;
},

consumeBuffers: function(length) {
  var value = this.slice(0, length);
  this.consume(length);
  return value;
},

consume: function(length) {
  if (length > this.length) throw new Error(
    'length out of bounds ' + length + ' > ' + this.length);

  var oldLength = this.length;
  var oldOffset = this._offset;

  this._offset += length;
  while (this._offset >= this.buffers[0].length) {
    dbg('       consume() shifting buffer, length',
      this.buffers[0].length);
    this._offset -= this.buffers[0].length;
    this._length -= this.buffers[0].length;
    this.buffers.shift();
  }

  dbg(  '       consume()', length, 'length', oldLength,
    '->', this.length, 'offset', oldOffset, '->', this._offset);
},

slice: function(start, end) {
  if (start < 0 || start >= this.length) throw new Error(
    'start out of bounds ' + start + ', 0 to ' + this.length + ' exclusive');
  if (end < 0 || end > this.length) throw new Error(
    'end out of bounds ' + end + ', 0 to ' + this.length + ' inclusive');
  if (end < start) throw new Error(
    'end ' + end + ' smaller than start ' + start);

  var bufferLength;

  // start position i0 (buffer array index) and j0 (index within buffer)
  var j0 = this._offset + start;
  for (var i0 = 0; i0 < this.buffers.length; i0++) {
    bufferLength = this.buffers[i0].length;
    if (j0 < bufferLength) break; // exclusive
    j0 -= bufferLength;
  }

  // end position i1 and j1
  if (end == null) {
    i1 = this.buffers.length - 1;
    j1 = this.buffers[i1].length;
  }
  else {
    var j1 = j0 + end - start;
    for (var i1 = i0; i1 < this.buffers.length; i1++) {
      bufferLength = this.buffers[i1].length;
      if (j1 <= bufferLength) break; // inclusive
      j1 -= bufferLength;
    }
  }

  var j1IfSame = i0 == i1 ? j1 : undefined;
  var firstBuffer = this.buffers[i0].slice(j0, j1IfSame);
  var buffers = new BufferChain(firstBuffer);
  if (j1IfSame != null) return buffers;

  for (var i = i0; i < i1 - 1; i++) buffers.push(this.buffers[i]);

  buffers.push(this.buffers[i].slice(0, j1));
  return buffers;
},

}

Object.defineProperties(BufferChain.prototype, {
  length: {
    get: function() { return this._length - this._offset; },
  },
});

