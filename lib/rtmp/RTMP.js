var rtmp = module.exports = {
  CHUNK_SIZE: 1,
  ABORT: 2,
  ACK: 3,
  PING: 4,
  SERVER: 5,
  BANDWITH: 6,
  AUDIO: 8,
  VIDEO: 9,
  FLEX_SO: 16,
  FLEX: 17,
  NOTIFY: 18,
  SO: 19,
  INVOKE: 20,
  isControl: function(typeid) {
    return typeid >= rtmp.CHUNK_SIZE && typeid <= rtmp.BANDWITH;
  },
}

