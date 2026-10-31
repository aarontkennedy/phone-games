// Generates the app icons as PNGs with no dependencies: a 2x2 grid of
// 2048-style tiles on the app background. Run with `npm run icons`.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const OUT = new URL('../public/icons/', import.meta.url);
const BG = [0x15, 0x13, 0x1f];
const TILES = [
  [0xee, 0xe4, 0xda],
  [0xf2, 0xb1, 0x79],
  [0xf6, 0x7c, 0x5f],
  [0xed, 0xc2, 0x2e],
];
// Keep the artwork inside the central 60% so it survives maskable cropping.
const START = 0.2;
const GAP = 0.04;
const TILE = (0.6 - GAP) / 2;
const RADIUS = 0.05;
const SAMPLES = 4; // supersampling per axis for smooth corners

function inRoundedRect(u, v, x0, y0) {
  const x1 = x0 + TILE;
  const y1 = y0 + TILE;
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const dx = Math.max(x0 + RADIUS - u, 0, u - (x1 - RADIUS));
  const dy = Math.max(y0 + RADIUS - v, 0, v - (y1 - RADIUS));
  return dx * dx + dy * dy <= RADIUS * RADIUS;
}

function colorAt(u, v) {
  for (let i = 0; i < 4; i++) {
    const x0 = START + (i % 2) * (TILE + GAP);
    const y0 = START + Math.floor(i / 2) * (TILE + GAP);
    if (inRoundedRect(u, v, x0, y0)) return TILES[i];
  }
  return BG;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const sum = [0, 0, 0];
      for (let sy = 0; sy < SAMPLES; sy++) {
        for (let sx = 0; sx < SAMPLES; sx++) {
          const c = colorAt((x + (sx + 0.5) / SAMPLES) / size, (y + (sy + 0.5) / SAMPLES) / size);
          sum[0] += c[0];
          sum[1] += c[1];
          sum[2] += c[2];
        }
      }
      const o = y * stride + 1 + x * 3;
      for (let ch = 0; ch < 3; ch++) raw[o + ch] = Math.round(sum[ch] / (SAMPLES * SAMPLES));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const [name, size] of [
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
]) {
  writeFileSync(new URL(name, OUT), png(size));
  console.log(`wrote public/icons/${name}`);
}
