import { deflateSync } from "node:zlib";

// A tiny PNG encoder so the mock image provider can draw a placeholder without any
// native dependency. RGBA, 8-bit, no interlace.

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const typeBytes = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, Buffer.from(data)])));
  return Buffer.concat([length, typeBytes, Buffer.from(data), crc]);
}

export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", new Uint8Array(0)),
  ]);
}

/** A soft, mission-coloured placeholder whose blobs depend on the prompt text. */
export function placeholderImage(seedText: string, size = 512): Buffer {
  let seed = 2166136261;
  for (const ch of seedText) seed = (seed ^ ch.charCodeAt(0)) * 16777619;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  const rgba = new Uint8Array(size * size * 4);
  const blobs = Array.from({ length: 6 }, () => ({
    x: rand() * size,
    y: rand() * size,
    r: size * (0.12 + rand() * 0.22),
    c: [[14, 90, 95], [156, 195, 195], [227, 236, 236], [217, 130, 43]][Math.floor(rand() * 4)],
  }));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // warm page background with a faint vertical gradient
      let r = 246, g = 246, b = 244 - (y / size) * 12;
      for (const blob of blobs) {
        const d = Math.hypot(x - blob.x, y - blob.y);
        if (d < blob.r) {
          const t = 1 - d / blob.r;
          r = r + (blob.c[0] - r) * t;
          g = g + (blob.c[1] - g) * t;
          b = b + (blob.c[2] - b) * t;
        }
      }
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
      rgba[i + 3] = 255;
    }
  }
  return encodePng(size, size, rgba);
}
