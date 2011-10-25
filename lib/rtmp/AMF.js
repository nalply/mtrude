"use strict"

var mtrude = require('mtrude');
var BufferChain = mtrude.BufferChain;

var AMF = module.exports = {};

AMF.deserialize = function(data) {
  if (data.ptr == null) data.ptr = 0;
  //if (data.amfReferences == null) data.amfReferences = [];

  var values = [];
  try {
    while (data.ptr < data.length) values.push(amfZeroAny(data));
  }
  catch (err) {
    console.log('deserialize(): ' + err);
  }

  return values;
}

AMF.amfZeroMarkers = {
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

function amfZeroAny(data) {
  var a0 = AMF.amfZeroMarkers;
  var marker = data.readUInt8(data.ptr++);
  var ptr = data.ptr;

  switch (marker) {
    case a0.NUMBER:       data.ptr += 8; return data.readDoubleBE(ptr);
    case a0.BOOLEAN:      data.ptr++; return data.readUInt8(ptr) != 0;
    case a0.STRING:       return amfZeroString(data);
    case a0.OBJECT:       return amfZeroObject(data);
    case a0.NULL:         return null;
    case a0.UNDEFINED:    return void 0;
    case a0.ECMA_ARRAY:   return amfZeroEcmaArray(data);
    case a0.STRICT_ARRAY: return amfZeroStrictArray(data);
    case a0.DATE:         return amfZeroDate(data);
    default: throw new Error('Unsupported marker 0x%s', marker.toString(16));
  }
}

function amfZeroString(data) {
  var length = data.readUInt16BE(data.ptr);
  var ptr = data.ptr += 2;
  data.ptr += length;
  return data.toString('utf8', ptr, ptr + length);
}

function amfZeroObject(data) {
  var object = {};
  while (true) {
    var key = amfZeroString(data);
    if (key == '') {
      var marker = data.readUInt8(data.ptr++);
      if (marker != AMF.amfZeroMarkers.OBJECT_END) throw new Error(
        'Bad end-of-object marker 0x%s != 0x9', marker.toString(16));
      break;
    }
    object[key] = amfZeroAny(data);
  }
  return object;
}

function amfZeroEcmaArray(data) {
  data.ptr += 4; /* ignore length */
  return amfZeroObject(data);
}

function amfZeroStrictArray(data) {
  var array = []

  var count = data.readUInt32BE(data.ptr);
  data.ptr += 4;
  for (var i = 0; i < count; i++) array.push(amfZeroAny(data));

  return array;
}

function amfZeroDate(data) {
  var date = new Date();
  date.setTime = data.readDoubleBE(data.ptr);
  data.ptr += 10; // including ignored time zone
}

