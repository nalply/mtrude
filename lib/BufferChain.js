"use strict";

function dbg() {
  if (BufferChain.DBG) console.log.apply(console, arguments);
}


/** Work with data in multiple buffers, but don't copy.
  * - Same interface as Buffer
  * - Consume (i.e. read and throw away)
  * - Push buffer
  * - Slice
*/
var BufferChain = module.exports = function(buffer, ptr) {
  this.chain = [];
  this.ptr = +ptr || 0;
  this._length = 0;
  this.push(buffer);

  Object.seal(this);
}

BufferChain.prototype = {

push: function(buffer) {
  if (buffer instanceof Buffer) {
    this.chain.push(buffer);
    this._length += buffer.length;
    return true;
  }
  else {
    return false;
  }
},

_index: function(ptr) {
  var index = 0;
  while (this.chain[index].length < ptr)
    ptr -= this.chain[index++].length;

  return [index, ptr];
},

readUInt8: function(ptr) {
  var index = this._index(ptr);
  return this.chain[index[0]].readUInt(index[1]);
},

consumeUInt8: function() {
  var value = this.chain[0][this.ptr];
  this.consume(1);
  return value;
},

readUInt32BE: function(ptr) {
  var index = this._index(ptr);
  return this.chain[index[0]].readUInt32BE(index[1]);
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

readUInt16BE: function(ptr) {
  var index = this._index(ptr);
  return this.chain[index[0]].readUInt16BE(index[1]);
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
  var oldPtr = this.ptr;

  this.ptr += length;
  while (this.ptr >= this.chain[0].length) {
    dbg('       consume() shifting buffer, length',
      this.chain[0].length);
    this.ptr -= this.chain[0].length;
    this._length -= this.chain[0].length;
    this.chain.shift();
  }

  dbg(  '       consume()', length, 'length', oldLength,
    '->', this.length, 'ptr', oldPtr, '->', this.ptr);
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
  var j0 = this.ptr + start;
  for (var i0 = 0; i0 < this.chain.length; i0++) {
    bufferLength = this.chain[i0].length;
    if (j0 < bufferLength) break; // exclusive
    j0 -= bufferLength;
  }

  // end position i1 and j1
  if (end == null) {
    i1 = this.chain.length - 1;
    j1 = this.chain[i1].length;
  }
  else {
    var j1 = j0 + end - start;
    for (var i1 = i0; i1 < this.chain.length; i1++) {
      bufferLength = this.chain[i1].length;
      if (j1 <= bufferLength) break; // inclusive
      j1 -= bufferLength;
    }
  }

  var j1IfSame = i0 == i1 ? j1 : undefined;
  var firstBuffer = this.chain[i0].slice(j0, j1IfSame);
  var chain = new BufferChain(firstBuffer);
  if (j1IfSame != null) return chain;

  for (var i = i0; i < i1 - 1; i++) chain.push(this.chain[i]);

  chain.push(this.chain[i].slice(0, j1));
  return chain;
},

}

Object.defineProperties(BufferChain.prototype, {
  length: {
    get: function() { return this._length - this.ptr; },
  },
});

