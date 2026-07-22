import { writeFileSync, mkdirSync } from "fs";
import { deflateSync } from "zlib";

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  const result = Buffer.alloc(4);
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 0);
  return result;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeB, data]));
  return Buffer.concat([len, typeB, data, crc]);
}

function createSolidPNG(size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = makeChunk("IHDR", ihdr);

  // Solid emerald (#059669) pixels
  const primaryGreen = [22, 163, 74];
  const rawRows = [];
  for (let y = 0; y < size; y++) {
    rawRows.push(0); // filter byte - none
    for (let x = 0; x < size; x++) {
      rawRows.push(primaryGreen[0], primaryGreen[1], primaryGreen[2], 255);
    }
  }

  const raw = Buffer.from(rawRows);
  const compressed = deflateSync(raw);
  const idatChunk = makeChunk("IDAT", compressed);
  const iendChunk = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const dir = "public/icons";
mkdirSync(dir, { recursive: true });

for (const size of [192, 512]) {
  const png = createSolidPNG(size);
  const path = `${dir}/icon-${size}x${size}.png`;
  writeFileSync(path, png);
  console.log(`Created ${path} (${png.length} bytes) - valid PNG: ${png[0] === 0x89 && png[1] === 0x50}`);
}
