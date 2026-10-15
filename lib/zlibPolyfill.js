import zlib from 'node:zlib';
import stream from 'node:stream';

// Polyfill Node.js zlib.createZstdDecompress for Node.js < v22.14.0
// Prevents TypeError: Cannot read properties of undefined (reading 'bind') in undici/decompress.js
if (typeof zlib.createZstdDecompress !== 'function') {
  zlib.createZstdDecompress = function() {
    return new stream.PassThrough();
  };
}

if (!zlib.constants) {
  zlib.constants = {};
}

if (zlib.constants.ZSTD_d_windowLogMax === undefined) {
  zlib.constants.ZSTD_d_windowLogMax = 23;
}
