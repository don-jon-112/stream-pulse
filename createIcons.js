// Create high quality SVG icon that can also be used directly and converted
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e1b4b" />
      <stop offset="100%" stop-color="#090d16" />
    </linearGradient>
    <linearGradient id="streamGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9146FF" />
      <stop offset="50%" stop-color="#FF0050" />
      <stop offset="100%" stop-color="#00F2FE" />
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Background rounded box -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)" />
  <rect width="504" height="504" x="4" y="4" rx="108" fill="none" stroke="url(#streamGrad)" stroke-width="6" opacity="0.6"/>

  <!-- Chat Bubble 1 -->
  <path d="M120 160 C 120 120, 392 120, 392 160 C 392 230, 320 250, 290 250 L 250 290 L 250 250 L 170 250 C 130 250, 120 210, 120 160 Z" fill="url(#streamGrad)" filter="url(#glow)" opacity="0.9" />

  <!-- Lightning Bolt (Realtime / Power) -->
  <polygon points="275,145 235,225 265,225 240,305 305,215 270,215" fill="#ffffff" filter="url(#glow)"/>

  <!-- Multi-Stream Dots (Twitch, YouTube, TikTok) -->
  <circle cx="170" cy="355" r="28" fill="#9146FF" />
  <circle cx="256" cy="355" r="28" fill="#FF0000" />
  <circle cx="342" cy="355" r="28" fill="#00F2FE" />

  <!-- Icons inside dots -->
  <polygon points="163,345 163,365 177,355" fill="#ffffff" />
  <polygon points="249,345 249,365 265,355" fill="#ffffff" />
  <circle cx="342" cy="355" r="10" fill="#fe2c55" />
</svg>`;

const iconDir = path.join(__dirname, 'public', 'icons');
fs.writeFileSync(path.join(iconDir, 'icon.svg'), svgContent);

// A valid minimal 192x192 and 512x512 PNG buffer generator (single color/gradient or basic PNG structure)
// We write a standalone PNG so browsers/PWAs have valid icon-192.png and icon-512.png
function createMinimalPng(width, height) {
  // Simple uncompressed valid PNG with zlib deflate
  import('zlib').then(({ deflateSync }) => {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    
    // IHDR
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type RGBA
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace
    const ihdrChunk = createChunk('IHDR', ihdr);

    // Scanlines
    const rawData = Buffer.alloc((width * 4 + 1) * height);
    for (let y = 0; y < height; y++) {
      const offset = y * (width * 4 + 1);
      rawData[offset] = 0; // Filter type 0
      for (let x = 0; x < width; x++) {
        const px = offset + 1 + x * 4;
        // Cyber purple-blue background with gradient
        const factor = (x + y) / (width + height);
        rawData[px] = Math.round(99 + factor * 80);     // R (indigo/purple)
        rawData[px + 1] = Math.round(50 + factor * 10); // G
        rawData[px + 2] = Math.round(240 - factor * 30);// B
        rawData[px + 3] = 255;                          // A
      }
    }
    const compressed = deflateSync(rawData);
    const idatChunk = createChunk('IDAT', compressed);
    const iendChunk = createChunk('IEND', Buffer.alloc(0));

    const png = Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
    fs.writeFileSync(path.join(iconDir, `icon-${width}.png`), png);
    console.log(`Created icon-${width}.png (${png.length} bytes)`);
  });
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  
  // CRC32
  let crc = 0 ^ (-1);
  for (let i = 0; i < body.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ body[i]) & 0xFF];
  }
  crc = (crc ^ (-1)) >>> 0;
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([len, body, crcBuf]);
}

const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
  }
  crcTable[n] = c;
}

createMinimalPng(192, 192);
createMinimalPng(512, 512);
