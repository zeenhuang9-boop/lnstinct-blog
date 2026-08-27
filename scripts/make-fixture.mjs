// 生成一张 320x200 的示例 PNG（暖纸色底 + 锈红横条），用于图片上传 E2E 测试。
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const WIDTH = 320;
const HEIGHT = 200;

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBuffer = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuffer, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

// 原始像素：每行前置 1 字节 filter=0，然后 RGB。
const raw = Buffer.alloc(HEIGHT * (1 + WIDTH * 3));
for (let y = 0; y < HEIGHT; y++) {
  const rowStart = y * (1 + WIDTH * 3);
  raw[rowStart] = 0;
  for (let x = 0; x < WIDTH; x++) {
    const offset = rowStart + 1 + x * 3;
    if (y < 40) {
      raw[offset] = 0xf7;
      raw[offset + 1] = 0xf1;
      raw[offset + 2] = 0xe7;
    } else if (y < 60) {
      raw[offset] = 0xa8;
      raw[offset + 1] = 0x50;
      raw[offset + 2] = 0x2f;
    } else {
      raw[offset] = 0x2b;
      raw[offset + 1] = 0x26;
      raw[offset + 2] = 0x20;
    }
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(WIDTH, 0);
ihdr.writeUInt32BE(HEIGHT, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 2; // color type RGB
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);

const target = path.join(process.cwd(), 'tests', 'fixtures', 'sample.png');
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, png);
console.log(`written ${target} (${png.length} bytes)`);
