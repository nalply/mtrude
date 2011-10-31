var rtmp = module.exports = {}

var types = rtmp.types = {
  CHUNK_SIZE: 1,
  ABORT: 2,
  ACK: 3,
  PING: 4,
  SERVER: 5,    // with Acknowledgement Window Size
  BANDWIDTH: 6, // with Acknowledgement Window Size and Limit type
  AUDIO: 8,
  VIDEO: 9,
  DATA: 15,     // same as NOTIFY but with AMF3
  FLEX_SO: 16,  // same as SO but with AMF 3
  FLEX: 17,     // same as INVOKE but with AMF3
  NOTIFY: 18,
  SO: 19,
  INVOKE: 20,
};

rtmp.typeNames = {}
for (var key in types) rtmp.typeNames[types[key]] = key;

// FLEX and INVOKE take as parameters:
// - command name
// - transaction id
// - command object (parameters)

// DATA and NOTIFY ... (see RTMP Commands 3.2)

// FLEX_SO and SO encode Shared Object events. For details see RTMP Commands
// 3.3. In short it's a bit confusing and not well explained. But SO are not
// important for Tikato and therefore mtrude will not support SO (or much
// later).

// Low level control commands which must be handled by MessageStream itself.
// Some of them are emitted as 'control' events. PING is emitted as a 'ping'
// event.
rtmp.isControl = function(typeid) {
  return typeid >= types.CHUNK_SIZE && typeid <= types.BANDWIDTH;
};


// PING is named "User Control message" and has the form 16bit type then data
// (depends on the type). For details see: RTMP Commands 3.7, page 9.
// type  what len source description
//  0    BEGIN  4 Server ID of stream to be sent now
//  1      EOF  4 Server ID of stream which has ended or will end
//  2      DRY  4 Server ID of stream which has momentarily no data
//  3   BUFLEN  8 Client Allocate a buffer (in ms) for stream ID
//  4 RECORDED  4 Server ID of stream which is recorded
//  6     PING  4 Server Are you there (with timestamp)?
//  7     PONG  4 Client I am here (send back same timestamp)
var pings = rtmp.pings = {
  BEGIN: 0, EOF: 1, DRY: 2, BUFLEN: 3, RECORDED: 4, PING: 6, PONG: 7,
}

rtmp.pingNames = {};
for (var key in pings) rtmp.pingNames[pings[key]] = key;

