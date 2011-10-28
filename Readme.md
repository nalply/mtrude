# mtrude - extrude media with node.js

The project is in an early stage. Already done:

- Buffer Chain 80% (slicing over buffer boundaries not well tested)
- RTMP Chunk Stream 90% (sending not well tested)
- RTMP Message Stream 80% (sending not well tested)
- AMF 60% (only deserializing; no XML, AMF0 long string, AMF3 object; no
references; no tests)

Future todos:

- Base application support for connect, play, publish, pause, seek, resume
- Base application allback support or similar architecture
- SSL support

Not planned:

- Shared Objects
- Flash RPC (RTMP typeid 15 or 18)
- XML support
- In general: just the minimum to for our use case (see below)

## Use case

A simple streaming: `NetConnection.play()` and webcam recording: `NetConnection.record()`
server solution is needed for secure deferred sign language communication. Deferred means
a sign language analogue to mail: one sends a sign language message and does not expect
an immediate answer. This use case is a bit different from the majority of the available
web video deployments: the focus is *secure* recording, while a product like YouTube does
not need to worry about the privacy of the submitted or recorded videos.

And that's why a lot of the available software have a hidden limitation or other. It's
difficult to find something which conforms to all the requirements of that use case and
is cheap at the same time.

## Implementation

### Buffer

With node.js 0.6.0 onward the binary buffer is more powerful with binary data types (it
understands IEEE 754 (Javascript Number or C double) out of the box). Additionally mtrude
provides a buffer chain with the same interface as the binary buffer. With chunking data
does not arrive in whole. Buffer Chain copies data or shims the access (I still don't
know which is better, I am trying out a shim).

### Network layers

RTMP uses a Chunk Stream as a low-level TCP protocol and a Message Stream protocol
to multiplex messages onto a single ActionScript3 `NetConnection` instance.
mtrude's `ChunkStream` is a wrapper around a socket (or a bidirectional node.js
stream like a two-way pipe) and emits events like 'handshake' and 'chunk'.
mtrude's `MessageStream` agains wraps a `ChunkStream` and
emits 'message' events. `MessageStream` can again be wrapped by an RTMP
application.

### SSL

RTMPS seems to come in two flavors: RTMP within an SSL tunnel or RTMP within an HTTPS
tunnel, the former being preferred as it is simpler and more efficient. Flash players
are a bit picky and seem to fall back to RTMP within HTTPS very soon.

## Examples

Have a look in the `examples` subdirectory.

## Sources and tools

### Specifications

- [Adobe rtmp spec](http://wwwimages.adobe.com/www.adobe.com/content/dam/Adobe/en/devnet/rtmp/pdf/rtmp_specification_1.0.pdf)
- [Adobe amf0 spec](http://opensource.adobe.com/wiki/download/attachments/1114283/amf0_spec_121207.pdf)
- [Adobe amf3 spec](http://opensource.adobe.com/wiki/download/attachments/1114283/amf3_spec_05_05_08.pdf)

### Other implementations of RTMP and AMF

Sometimes these implementations are only partial implementations. Caveat emptor.

- [Flash Media Server](http://www.adobe.com/products/flashmediaserver/)
- [Red5](http://red5.org)
- [crtmpserver](http://rtmpd.com)
- [librtmp](http://coderepos.org/share/browser/lang/c/librtmp/rtmp.c)
- [node-amf, RTMP support incomplete](http://timwhitlock.info/blog/2010/08/07/node-amf-and-node-rtmp)
- [ArcusNode, RTMFP](https://github.com/OpenRTMFP/ArcusNode)

### Reverse engineering tools

tcpflow together with rtmptool allow easy and thorough examinations of rtmp connections.

- [tcpflow](http://afflib.org/software/tcpflow)
- [rtmptool](https://bitbucket.org/intgr/rtmptool)

## MIT License

 Copyright Daniel Ly. All rights reserved.

 Permission is hereby granted, free of charge, to any person obtaining
 a copy of this software and associated documentation files (the
 'Software'), to deal in the Software without restriction, including
 without limitation the rights to use, copy, modify, merge, publish,
 distribute, sublicense, and/or sell copies of the Software, and to
 permit persons to whom the Software is furnished to do so, subject to
 the following conditions:

 The above copyright notice and this permission notice shall be
 included in all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
 EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.