/**
 * Zero-dependency PNG encoder plus a tiny software rasteriser.
 * Used at build time to generate PWA icons and social cards without
 * pulling in native image libraries (sharp/canvas).
 */
import zlib from "node:zlib";

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1)
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** Encode raw RGBA bytes (Uint8ClampedArray, length = w*h*4) into a PNG buffer. */
export function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc(height * (stride + 1));
  const src = Buffer.from(rgba.buffer, rgba.byteOffset, rgba.length);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    src.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const SUPERSAMPLE = 3;

function parseColor(color) {
  if (Array.isArray(color)) return color;
  const hex = color.replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
    255,
  ];
}

/** Small immediate-mode canvas that renders at 3x and box-downsamples for anti-aliasing. */
export class Raster {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.ss = SUPERSAMPLE;
    this.w = width * this.ss;
    this.h = height * this.ss;
    this.data = new Uint8ClampedArray(this.w * this.h * 4);
  }

  /** Blend a colour onto one supersampled pixel. */
  _blend(x, y, color, alpha) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || alpha <= 0) return;
    const [r, g, b, a] = color;
    const i = (y * this.w + x) * 4;
    const sa = (alpha * (a / 255));
    const da = this.data[i + 3] / 255;
    const outA = sa + da * (1 - sa);
    if (outA <= 0) return;
    this.data[i] = (r * sa + this.data[i] * da * (1 - sa)) / outA;
    this.data[i + 1] = (g * sa + this.data[i + 1] * da * (1 - sa)) / outA;
    this.data[i + 2] = (b * sa + this.data[i + 2] * da * (1 - sa)) / outA;
    this.data[i + 3] = outA * 255;
  }

  fillRect(x, y, w, h, color) {
    const c = parseColor(color);
    const s = this.ss;
    for (let py = Math.round(y * s); py < Math.round((y + h) * s); py += 1)
      for (let px = Math.round(x * s); px < Math.round((x + w) * s); px += 1)
        this._blend(px, py, c, 1);
  }

  /** Vertical linear gradient rectangle. */
  gradientRect(x, y, w, h, from, to) {
    const a = parseColor(from);
    const b = parseColor(to);
    const s = this.ss;
    const y0 = Math.round(y * s);
    const y1 = Math.round((y + h) * s);
    for (let py = y0; py < y1; py += 1) {
      const t = Math.min(1, Math.max(0, (py - y0) / Math.max(1, y1 - y0 - 1)));
      const c = [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t,
        255,
      ];
      for (let px = Math.round(x * s); px < Math.round((x + w) * s); px += 1)
        this._blend(px, py, c, 1);
    }
  }

  circle(cx, cy, r, color, alpha = 1) {
    this.ellipse(cx, cy, r, r, color, alpha);
  }

  ellipse(cx, cy, rx, ry, color, alpha = 1) {
    const c = parseColor(color);
    const s = this.ss;
    const x0 = Math.round((cx - rx) * s);
    const x1 = Math.round((cx + rx) * s);
    const y0 = Math.round((cy - ry) * s);
    const y1 = Math.round((cy + ry) * s);
    for (let py = y0; py <= y1; py += 1) {
      const ny = (py - cy * s) / (ry * s);
      for (let px = x0; px <= x1; px += 1) {
        const nx = (px - cx * s) / (rx * s);
        if (nx * nx + ny * ny <= 1) this._blend(px, py, c, alpha);
      }
    }
  }

  roundRect(x, y, w, h, r, color, alpha = 1) {
    const c = parseColor(color);
    const s = this.ss;
    const x0 = Math.round(x * s);
    const y0 = Math.round(y * s);
    const x1 = Math.round((x + w) * s);
    const y1 = Math.round((y + h) * s);
    const rr = r * s;
    for (let py = y0; py < y1; py += 1)
      for (let px = x0; px < x1; px += 1) {
        const dx = Math.max(x0 + rr - px, 0, px - (x1 - rr)) / rr;
        const dy = Math.max(y0 + rr - py, 0, py - (y1 - rr)) / rr;
        if (dx * dx + dy * dy <= 1) this._blend(px, py, c, alpha);
      }
  }

  /** Thick line segment with round caps, used for the dragon's smile. */
  line(x0, y0, x1, y1, width, color, alpha = 1) {
    const c = parseColor(color);
    const half = width / 2;
    const minX = Math.min(x0, x1) - half;
    const maxX = Math.max(x0, x1) + half;
    const minY = Math.min(y0, y1) - half;
    const maxY = Math.max(y0, y1) + half;
    const s = this.ss;
    for (let py = Math.round(minY * s); py <= Math.round(maxY * s); py += 1)
      for (let px = Math.round(minX * s); px <= Math.round(maxX * s); px += 1) {
        const p = [(px + 0.5) / s, (py + 0.5) / s];
        const dx = x1 - x0;
        const dy = y1 - y0;
        const len2 = dx * dx + dy * dy || 1;
        const t = Math.min(
          1,
          Math.max(0, ((p[0] - x0) * dx + (p[1] - y0) * dy) / len2),
        );
        const qx = x0 + dx * t;
        const qy = y0 + dy * t;
        const dist = Math.hypot(p[0] - qx, p[1] - qy);
        if (dist <= half) this._blend(px, py, c, alpha);
      }
  }

  /** Arc stroke approximated by short segments. */
  arc(cx, cy, r, startDeg, endDeg, width, color, alpha = 1) {
    const steps = Math.max(8, Math.round(Math.abs(endDeg - startDeg) / 4));
    let prev = null;
    for (let i = 0; i <= steps; i += 1) {
      const a = ((startDeg + ((endDeg - startDeg) * i) / steps) * Math.PI) / 180;
      const p = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      if (prev) this.line(prev[0], prev[1], p[0], p[1], width, color, alpha);
      prev = p;
    }
  }

  /** Box-downsample to the final resolution. */
  toRGBA() {
    const s = this.ss;
    const out = new Uint8ClampedArray(this.width * this.height * 4);
    const n = s * s;
    for (let y = 0; y < this.height; y += 1)
      for (let x = 0; x < this.width; x += 1) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let sy = 0; sy < s; sy += 1)
          for (let sx = 0; sx < s; sx += 1) {
            const i = ((y * s + sy) * this.w + (x * s + sx)) * 4;
            const pa = this.data[i + 3] / 255;
            r += this.data[i] * pa;
            g += this.data[i + 1] * pa;
            b += this.data[i + 2] * pa;
            a += pa;
          }
        const o = (y * this.width + x) * 4;
        if (a > 0) {
          out[o] = r / a;
          out[o + 1] = g / a;
          out[o + 2] = b / a;
        }
        out[o + 3] = (a / n) * 255;
      }
    return out;
  }

  toPNG() {
    return encodePNG(this.width, this.height, this.toRGBA());
  }
}
