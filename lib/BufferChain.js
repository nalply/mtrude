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

BufferChain.DBG = false;

BufferChain.prototype = {

push: function(buffer) {
  if (buffer instanceof Buffer) {
    this.chain.push(buffer);
    this._length += buffer.length;
    return true;
  }
  else if (buffer instanceof BufferChain) {
    for (var i = 0; i < buffer.length; i++) this.push(buffer.chain[i]);
    return true;
  }
  else {
    return false;
  }
},

_index: function(ptr) {
  var index = 0;
  while (ptr >= this.chain[index].length) ptr -= this.chain[index++].length;
  return [index, ptr];
},

toString: function(encoding, start, end) {
  var subChain = this.slice(start, end);
  if (subChain.chain.length == 0) return '';
  if (subChain.chain.length == 1) return subChain.chain[0].toString(encoding);

  throw new Error('toString() over several buffers not implemented');
},

readDoubleBE: function(ptr) {
  var subChain = this.slice(ptr, ptr + 8);
  if (subChain.chain.length == 1) return subChain.chain[0].readDoubleBE(0);

  var buffer8 = new Buffer(8);
  for (var i = 0; i < 8; i++) buffer8[i] = subChain.readUInt8(i);
  return buffer8.readDoubleBE(0);
},

readUInt8: function(ptr) {
  var index = this._index(ptr);
  return this.chain[index[0]].readUInt8(index[1]);
},

consumeUInt8: function() {
  var value = this.chain[0][this.ptr];
  this.consume(1);
  return value;
},

readUInt32LE: function(ptr) {
  var index = this._index(ptr);
  return this.chain[index[0]].readUInt32LE(index[1]);

  // todo cross-buffer read
},

readUInt32BE: function(ptr) {
  var index = this._index(ptr);
  return this.chain[index[0]].readUInt32BE(index[1]);

  // todo cross-buffer read
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
  var value = this.slice(this.ptr, this.ptr + length);
  this.consume(length);
  return value;
},

consume: function(length) {
  if (length > this.rest) throw new Error(
    'length out of bounds ' + length + ' > ' + this.rest);

  var oldRest = this.rest;
  var oldPtr = this.ptr;
  var value1 = this.chain[0][oldPtr];

  this.ptr += length;
  var length0 = this.chain[0].length;
  while (this.ptr >= length0) {
    dbg('       consume() shifting buffer of length', length0, 'ptr',
      this.ptr, '->', this.ptr - length0);
    this.ptr -= length0;
    this._length -= length0;
    this.chain.shift();
  }

  dbg(  '       consume()', '0x' + value1.toString(16),
    length, 'rest', oldRest, '->', this.rest, 'ptr', oldPtr, '->', this.ptr);
},

slice: function(start, end) {
  if (start < 0 || start >= this._length) throw new Error(
    'start out of bounds ' + start + ', 0 to ' + this.length + ' exclusive');
  if (end < 0 || end > this._length) throw new Error(
    'end out of bounds ' + end + ', 0 to ' + this.length + ' inclusive');
  if (end < start) throw new Error(
    'end ' + end + ' smaller than start ' + start);

  var bufferLength;

  // start position i0 (buffer array index) and j0 (index within buffer)
  var j0 = start;
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
    get: function() { return this._length; },
  },
  rest: {
    get: function() { return this._length - this.ptr; },
  },
});

