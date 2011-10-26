var fs = require('fs');

module.exports = function asSocket(incoming, outgoing, icb, ocb) {
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

