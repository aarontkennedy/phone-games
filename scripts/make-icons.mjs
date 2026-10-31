// Generates the app icons as PNGs with no dependencies. Flat design: a solid
// background with four simple game-piece shapes (circle, square, triangle,
// diamond) in solid colors. Run with `npm run icons`.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const OUT = new URL('../public/icons/', import.meta.url);
const BG = [0x6c, 0x63, 0xff];
const WHITE = [0xff, 0xff, 0xff];
const GOLD = [0xff, 0xd2, 0x3f];
const SAMPLES = 4; // supersampling per axis for clean edges

// Shapes in unit coordinates, kept inside the central 60% so they survive
// maskable-icon cropping. Each returns true if (u, v) is inside.
const SHAPES = [
  // circle, top-left
  [WHITE, (u, v) => (u - 0.36) ** 2 + (v - 0.36) ** 2 <= 0.11 ** 2],
  // rounded square, top-right
  [GOLD, (u, v) => inRoundedRect(u, v, 0.54, 0.26, 0.74, 0.46, 0.03)],
  // triangle, bottom-left
  [GOLD, (u, v) => inTriangle(u, v, [0.36, 0.53], [0.245, 0.74], [0.475, 0.74])],
  // diamond, bottom-right
  [WHITE, (u, v) => Math.abs(u - 0.64) + Math.abs(v - 0.64) <= 0.12],
];

function inRoundedRect(u, v, x0, y0, x1, y1, r) {
  if (u < x0 || u > x1 || v < y0 || v > y1) return false;
  const dx = Math.max(x0 + r - u, 0, u - (x1 - r));
  const dy = Math.max(y0 + r - v, 0, v - (y1 - r));
  return dx * dx + dy * dy <= r * r;
}

function inTriangle(u, v, a, b, c) {
  const side = (p, q) => (u - q[0]) * (p[1] - q[1]) - (p[0] - q[0]) * (v - q[1]);
  const s1 = side(a, b);
  const s2 = side(b, c);
  const s3 = side(c, a);
  return !((s1 < 0 || s2 < 0 || s3 < 0) && (s1 > 0 || s2 > 0 || s3 > 0));
}

function colorAt(u, v) {
  for (const [color, inside] of SHAPES) if (inside(u, v)) return color;
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
