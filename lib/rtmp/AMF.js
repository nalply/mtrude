"use strict"

var util = require('util');
var assert = require('assert');
var BufferChain = require('../BufferChain');

var AMF = module.exports = {};

AMF.deserializeZ = function(data, emitter) {
  if (data.ptr == null) data.ptr = 0;

  var values = [];
  try {
    while (data.ptr < data.length) values.push(amfZAny(data));
  }
  catch (err) {
    var message = 'AMF.deserialize(): ' + err;
    if (emitter && emitter.emit) emitter.emit('error', message);
    else console.log('ERROR: ' + message);
  }

  return values;
}

AMF.amfZMarkers = {
  NUMBER:       0x00,
  BOOLEAN:      0x01,
  STRING:       0x02,
  OBJECT:       0x03,
  MOVIECLIP:    0x04, // not supported
  NULL:         0x05,
  UNDEFINED:    0x06,
  REFERENCE:    0x07,
  ECMA_ARRAY:   0x08,
  OBJECT_END:   0x09,
  STRICT_ARRAY: 0x0a,
  DATE:         0x0b,
  LONG_STRING:  0x0c,
  UNSUPPORTED:  0x0d,
  RECORDSET:    0x0e, // not supported
  XML_DOCUMENT: 0x0f,
  TYPED_OBJECT: 0x10,
  AVMPLUS:      0x11, // switch to AMF3
}

var a0 = AMF.amfZMarkers;

function amfZAny(data) {
  var marker = data.readUInt8(data.ptr++);
  var ptr = data.ptr;

  switch (marker) {
    case a0.NUMBER:       data.ptr += 8; return data.readDoubleBE(ptr);
    case a0.BOOLEAN:      data.ptr++; return data.readUInt8(ptr) != 0;
    case a0.STRING:       return amfZString(data);
    case a0.OBJECT:       return amfZObject(data);
    case a0.NULL:         return null;
    case a0.UNDEFINED:    return void 0;
    case a0.ECMA_ARRAY:   return amfZEcmaArray(data);
    case a0.STRICT_ARRAY: return amfZStrictArray(data);
    case a0.DATE:         return amfZDate(data);
    default: throw new Error('Unsupported AMF0 marker 0x'
      + marker.toString(16));
  }
}

function amfZString(data) {
  var length = data.readUInt16BE(data.ptr);
  var ptr = data.ptr += 2;
  data.ptr += length;
  return data.toString('utf8', ptr, ptr + length);
}

function amfZObject(data) {
  var object = {};
  while (true) {
    var key = amfZString(data);
    if (key == '') {
      var marker = data.readUInt8(data.ptr++);
      if (marker != AMF.amfZMarkers.OBJECT_END) throw new Error(
        'Bad end-of-object marker 0x%s != 0x9', marker.toString(16));
      break;
    }
    object[key] = amfZAny(data);
  }
  return object;
}

function amfZEcmaArray(data) {
  data.ptr += 4; /* ignore length */
  return amfZObject(data);
}

function amfZStrictArray(data) {
  var array = []

  var count = data.readUInt32BE(data.ptr);
  data.ptr += 4;
  for (var i = 0; i < count; i++) array.push(amfZAny(data));

  return array;
}

function amfZDate(data) {
  var date = new Date();
  date.setTime = data.readDoubleBE(data.ptr);
  data.ptr += 10; // including ignored time zone
}

AMF.serializeZ = function() {
  var serBuffer = { buffer: new Buffer(200), ptr: 0 };
  for (var i = 0; i < arguments.length; i++)
    serZAny(serBuffer, arguments[i]);

  dbg(hexdump(serBuffer.buffer));

  return serBuffer.buffer;
}

function serZAny(serBuffer, value) {
  dbgSerBuffer('Any', serBuffer);
  if (value === null) return serZNull(serBuffer);
  if (value === void 0) return serZUndefined(serBuffer);
  if (value === true) return serZTrue(serBuffer);
  if (value === false) return serZFalse(serBuffer);
  if (typeof value == 'number') return serZNumber(serBuffer, value);
  if (typeof value == 'string') return serZString(serBuffer, value);
  if (Array.isArray(value)) return serZArray(serBuffer, value);
  if (typeof value == 'object') return serZObject(serBuffer, value);
  throw new Error('value type not supported');
}

function dbgSerBuffer(text, serBuffer, value) {
  assert(serBuffer.buffer && serBuffer.buffer.constructor == Buffer);
  function spaces(n) {
    var s = '';
    for (var i = 0; i < n; i++) s += ' ';
    return s;
  }
  var at = ' @ ' + serBuffer.ptr + ' / ' + serBuffer.buffer.length;
  console.log('serZ' + text + spaces(20 - text.length)
    + at + spaces(16 - at.length)
    + (value == null ? '' : util.inspect(value)));
}

function serZNull(serBuffer) {
  dbgSerBuffer('Null', serBuffer);
  maybeExpand(serBuffer, 1);
  serBuffer.buffer.writeUInt8(a0.NULL, serBuffer.ptr++);
}

function serZUndefined(serBuffer) {
  dbgSerBuffer('Undefined', serBuffer);
  maybeExpand(serBuffer, 1);
  serBuffer.buffer.writeUInt8(a0.UNDEFINED, serBuffer.ptr++);
}

function serZTrue(serBuffer) {
  dbgSerBuffer('True', serBuffer);
  maybeExpand(serBuffer, 2);
  serBuffer.buffer.writeUInt8(a0.BOOLEAN, serBuffer.ptr++);
  serBuffer.buffer.writeUInt8(1, serBuffer.ptr++);
}

function serZFalse(serBuffer) {
  dbgSerBuffer('False', serBuffer);
  maybeExpand(serBuffer, 2);
  serBuffer.buffer.writeUInt8(a0.BOOLEAN, serBuffer.ptr++);
  serBuffer.buffer.writeUInt8(0, serBuffer.ptr++);
}

function serZNumber(serBuffer, value) {
  dbgSerBuffer('Number', serBuffer, value);
  maybeExpand(serBuffer, 9);

  serBuffer.buffer.writeUInt8(a0.NUMBER, serBuffer.ptr);
  serBuffer.buffer.writeDoubleBE(value, serBuffer.ptr + 1);
  serBuffer.ptr += 8;
}

function serZString(serBuffer, value, withMarker) {
  dbgSerBuffer('String', serBuffer, value);
  var len = Buffer.byteLength(value);
  if (len > 65535) throw new Error('no more than 65535 bytes in a string');
  maybeExpand(serBuffer, len + 2 + withMarker ? 1 : 0);

  if (withMarker) serBuffer.buffer.writeUInt8(a0.STRING, serBuffer.ptr++);
  serBuffer.buffer.writeUInt16BE(len, serBuffer.ptr);
  serBuffer.buffer.write(value, serBuffer.ptr + 2);
  assert(serBuffer.buffer.constructor == Buffer);
  serBuffer.ptr += len + 2;
}

// Note: only serializes the array elements, not the additional associative
// elements.
function serZArray(serBuffer, value) {
  dbgSerBuffer('Array', serBuffer, {length: value.length});
  maybeExpand(serBuffer, 4);
  serBuffer.buffer.writeUInt32BE(value.length, serBuffer.ptr);
  serBuffer.ptr += 4;

  for (var i = 0; i < value.length; i++) serZAny(serBuffer, value[i]);
}

function serZObject(serBuffer, value) {
  dbgSerBuffer('Object', serBuffer, {keys: Object.keys(value).join(' ')});
  for (var key in value) {
    serZString(serBuffer, key, false);
    serZAny(serBuffer, value[key]);
  }
  serZString(serBuffer, '', false);
  maybeExpand(serBuffer, 1);
  serBuffer.buffer.writeUInt8(a0.OBJECT_END, serBuffer.ptr++);
}

function maybeExpand(serBuffer, length) {
  if (serBuffer.ptr + length < serBuffer.buffer.length) return;

  length = Math.max(length, serBuffer.buffer.length);
  var buffer = new Buffer(serBuffer.buffer.length + length);
  serBuffer.buffer.copy(buffer);
  serBuffer.buffer = buffer;
  dbgSerBuffer(' - expanded', serBuffer);
}

AMF.deserialize3 = function(data, emitter) {
  if (data.ptr == null) data.ptr = 0;

  var type = data.readUInt8(data.ptr++);
  if (type == 0) return AMF.deserializeZ(data, emitter);
  try {
    if (type == 3) return amf3Any(data);
  }
  catch (err) {
    var message = 'AMF.deserialize3(): ' + err;
    if (emitter && emitter.emit) emitter.emit('error', message);
    else console.log('ERROR: ' + message);
  }
  throw new Error('Unknown AMF type #' + type);
}


AMF.amf3Markers = {
  UNDEFINED:    0x00,
  NULL:         0x01,
  FALSE:        0x02,
  TRUE:         0x03,
  INTEGER:      0x04,
  DOUBLE:       0x05,
  STRING:       0x06,
  XML_DOC:      0x07,
  DATE:         0x08,
  ARRAY:        0x09,
  OBJECT:       0x0a,
  XML:          0x0b,
  BYTEARRAY:    0x0c,
};

function amf3Any(data) {
  var a3 = AMF.amf3Markers;
  var marker = data.readUInt8(data.ptr++);
  var ptr = data.ptr;

  switch (marker) {
    case a3.UNDEFINED:    return void 0;
    case a3.NULL:         return null;
    case a3.FALSE:        return false;
    case a3.TRUE:         return true;
    case a3.INTEGER:      return amf3Integer(data);
    case a3.DOUBLE:       return data.ptr += 8; return data.readDoubleBE(ptr);
    case a3.STRING:       return amf3String(data);
    case a3.DATE:         return amf3Date(data);
    case a3.ARRAY:        return amf3Array(data);
    case a3.OBJECT:       return amf3Object(data);
    default: throw new Error('Unsupported AMF3 marker 0x'
      + marker.toString(16));
  }
}

// Read unsigned 29-bit Integer Encoding (AMF 3 Specification 1.3.1)
function amf3Integer(data) {
  var result = 0;
  for (var i = 0; i < 4; i++) {
    var x = data.readUInt8(data.ptr++);
    if (!(x & 0x80)) return result << 8 | x;
    result = result << 7 | (i == 3 ? x : x & 0x7f);
  }
  return result;
}

// Read string or reference (AMF 3 Specification 1.3.2)
function amf3String(data) {
  var length = amf3Integer(data);
  if (length & 0x01) {
    length = length >> 2;
    data.ptr += length;
    return data.toString('utf8', ptr, ptr + length);
  }
  else {
    throw new Error('String references not supported');
  }
}

function amf3Date(data) {
  var reference = amf3Integer(data);
  if (reference & 0x01) {
    var date = new Date();
    date.setTime = data.readDoubleBE(data.ptr);
    data.ptr += 8;
    return date;
  }
  else {
    throw new Error('Date referenes not supported');
  }
}

function amf3Array(data) {
  var denseLength = amf3Integer(data);
  if (denseLength & 0x01) {
    var array = [];
    while (true) {
      var key = amf3String(data);
      if (key == '') break;
      array[key] = amf3Any(data);
    }
    for (var i = 0; i < denseLength; i++) array[i] = amfAny(data);
    return array;
  }
  else {
    throw new Error('Array references not supported');
  }
}

function amf3Object(data) {
  var reference = amf3Integer(data);
  switch (reference & 0x07) {
    case 0x00: case 0x02: case 0x04: case 0x06:
      throw new Error('Object references not supported');
    case 0x01: case 0x05:
      throw new Error('Trait references not supported');
    case 0x03:
      throw new Error('Traits not supported');
    case 0x07:
      throw new Error('Externalizable classes not supported');
  }
}





