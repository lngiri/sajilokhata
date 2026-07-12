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

function createPNG(size) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);    // width
  ihdr.writeUInt32BE(size, 4);    // height
  ihdr[8] = 8;                     // bit depth
  ihdr[9] = 6;                     // color type RGBA
  ihdr[10] = 0;                    // compression
  ihdr[11] = 0;                    // filter
  ihdr[12] = 0;                    // interlace
  const ihdrChunk = makeChunk("IHDR", ihdr);

  const emerald = [5, 150, 105];   // rgb(5, 150, 105)
  const emeraldDark = [4, 120, 84];

  const rawRows = [];
  for (let y = 0; y < size; y++) {
    rawRows.push(0); // filter byte
    const t = y / size; // 0..1 top->bottom
    const r = Math.round(emerald[0] + (emeraldDark[0] - emerald[0]) * t);
    const g = Math.round(emerald[1] + (emeraldDark[1] - emerald[1]) * t);
    const b = Math.round(emerald[2] + (emeraldDark[2] - emerald[2]) * t);
    for (let x = 0; x < size; x++) {
      const cx = x / size - 0.5;
      const cy = y / size - 0.5;
      const inset = 0.22;
      const inRect = Math.abs(cx) < 0.5 - inset && Math.abs(cy) < 0.5 - inset;
      const white = inRect ? 1 : 0;
      rawRows.push(white ? 255 : r);
      rawRows.push(white ? 255 : g);
      rawRows.push(white ? 255 : b);
      rawRows.push(255); // alpha
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

const sizes = [192, 512];
for (const size of sizes) {
  const png = createPNG(size);
  const path = `${dir}/icon-${size}x${size}.png`;
  writeFileSync(path, png);
  console.log(`Created ${path} (${png.length} bytes)`);
}
