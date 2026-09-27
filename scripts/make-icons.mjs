/**
 * Generates the PWA icon set and the social sharing card.
 *
 *   node scripts/make-icons.mjs
 *
 * Everything is drawn procedurally so the repository stays free of binary
 * image-editing dependencies; output is written to public/.
 *
 * NOTE: all drawing happens in *output pixel* coordinates. The Raster class
 * internally supersamples, so callers never deal with the 3x grid.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Raster, encodePNG } from "./png.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public");

const SKY_TOP = "#3f92d8";
const SKY_BOTTOM = "#c6ecfc";
const BODY = "#ffd23f";
const BODY_SHADE = "#eeb200";
const BELLY = "#fff3c9";
const GREEN = "#31b45a";
const PUPIL = "#173a26";
const WHITE = "#ffffff";
const BLUSH = "#ff9aa2";

/** Draws the Nailong mascot centred on the raster, in pixel coordinates. */
function drawDragon(c, factor = 1) {
  const base = Math.min(c.width, c.height);
  const cx = c.width / 2;
  const cy = c.height * 0.55;
  const r = base * 0.26 * factor;

  // Wings peeking out behind the body.
  c.ellipse(cx - r * 1.18, cy - r * 0.12, r * 0.66, r * 0.42, "#e8f6ff");
  c.ellipse(cx + r * 1.18, cy - r * 0.12, r * 0.66, r * 0.42, "#e8f6ff");
  c.ellipse(cx - r * 1.24, cy + r * 0.16, r * 0.44, r * 0.26, "#c9e8f7");
  c.ellipse(cx + r * 1.24, cy + r * 0.16, r * 0.44, r * 0.26, "#c9e8f7");

  // Ears / horns.
  for (const dir of [-1, 1]) {
    c.circle(cx + dir * r * 0.62, cy - r * 0.86, r * 0.3, BODY_SHADE);
    c.circle(cx + dir * r * 0.62, cy - r * 0.86, r * 0.19, BELLY);
  }

  // Body + soft bottom shading.
  c.circle(cx, cy, r, BODY);
  c.ellipse(cx, cy + r * 0.4, r * 0.9, r * 0.5, BODY_SHADE, 0.32);

  // Belly patch.
  c.ellipse(cx, cy + r * 0.32, r * 0.58, r * 0.5, BELLY);

  // Arms.
  c.ellipse(cx - r * 0.94, cy + r * 0.2, r * 0.21, r * 0.31, BODY_SHADE);
  c.ellipse(cx + r * 0.94, cy + r * 0.2, r * 0.21, r * 0.31, BODY_SHADE);

  // Eyes.
  for (const dir of [-1, 1]) {
    c.ellipse(cx + dir * r * 0.38, cy - r * 0.2, r * 0.25, r * 0.29, WHITE);
    c.ellipse(cx + dir * r * 0.38, cy - r * 0.18, r * 0.2, r * 0.24, GREEN);
    c.ellipse(cx + dir * r * 0.38, cy - r * 0.16, r * 0.105, r * 0.15, PUPIL);
    c.circle(cx + dir * r * 0.32, cy - r * 0.29, r * 0.065, WHITE);
  }

  // Blush + smile.
  for (const dir of [-1, 1])
    c.ellipse(cx + dir * r * 0.78, cy + r * 0.12, r * 0.13, r * 0.09, BLUSH, 0.7);
  c.arc(cx, cy + r * 0.26, r * 0.24, 25, 155, r * 0.08, PUPIL);
}

function drawSky(c) {
  const W = c.width;
  const H = c.height;
  c.gradientRect(0, 0, W, H, SKY_TOP, SKY_BOTTOM);
  const glow = Math.min(W, H);
  for (let i = 10; i >= 1; i -= 1)
    c.circle(W * 0.8, H * 0.19, glow * (0.07 + i * 0.012), "#fff6c9", 0.03 * i);
  for (const [x, y, w] of [
    [0.17, 0.22, 0.1],
    [0.76, 0.8, 0.12],
    [0.35, 0.88, 0.08],
  ])
    c.ellipse(W * x, H * y, W * w, W * w * 0.5, WHITE, 0.7);
}

/** Punch transparent rounded corners so the icon reads well on any launcher. */
function maskCorners(c, radiusFraction) {
  const w = c.w;
  const h = c.h;
  const r = radiusFraction * w;
  for (let y = 0; y < h; y += 1)
    for (let x = 0; x < w; x += 1) {
      const dx = Math.max(r - x, 0, x - (w - r)) / r;
      const dy = Math.max(r - y, 0, y - (h - r)) / r;
      if (dx * dx + dy * dy > 1) c.data[(y * w + x) * 4 + 3] = 0;
    }
}

function makeIcon(size, { maskable = false, rounded = true, inset = 1 } = {}) {
  const c = new Raster(size, size);
  drawSky(c);
  if (rounded && !maskable) maskCorners(c, 0.22);
  drawDragon(c, 0.9 * inset);
  return c.toPNG();
}

/** Fallback social card: sky + mascot, used until a live screenshot exists. */
function makeSocialCard(width, height) {
  const c = new Raster(width, height);
  c.gradientRect(0, 0, width, height, "#2f7fc4", "#d6efff");
  const glow = Math.min(width, height);
  for (let i = 10; i >= 1; i -= 1)
    c.circle(width * 0.8, height * 0.22, glow * (0.06 + i * 0.012), "#fff3bf", 0.035 * i);

  const size = Math.round(height * 0.92);
  const sub = new Raster(size, size);
  drawDragon(sub, 0.9);
  const px = sub.toRGBA();
  const canvas = c.toRGBA();
  const ox = Math.round(width * 0.5 - size / 2);
  const oy = Math.round(height * 0.5 - size / 2);
  for (let y = 0; y < size; y += 1)
    for (let x = 0; x < size; x += 1) {
      const si = (y * size + x) * 4;
      const dx = ox + x;
      const dy = oy + y;
      if (dx < 0 || dy < 0 || dx >= width || dy >= height) continue;
      const di = (dy * width + dx) * 4;
      const a = px[si + 3] / 255;
      if (a <= 0) continue;
      canvas[di] = px[si] * a + canvas[di] * (1 - a);
      canvas[di + 1] = px[si + 1] * a + canvas[di + 1] * (1 - a);
      canvas[di + 2] = px[si + 2] * a + canvas[di + 2] * (1 - a);
      canvas[di + 3] = 255;
    }
  return encodePNG(width, height, canvas);
}

fs.mkdirSync(outDir, { recursive: true });

const written = [];
function write(name, buf) {
  fs.writeFileSync(path.join(outDir, name), buf);
  written.push(`${name} (${(buf.length / 1024).toFixed(1)} KB)`);
}

write("icon-192.png", makeIcon(192));
write("icon-512.png", makeIcon(512));
write("icon-maskable-512.png", makeIcon(512, { maskable: true, inset: 0.82 }));
write("apple-touch-icon.png", makeIcon(180, { rounded: false }));
write("favicon-48.png", makeIcon(48));
write("favicon-96.png", makeIcon(96));

const ogPath = path.join(outDir, "og-image.png");
const force = process.argv.includes("--force");
if (force || !fs.existsSync(ogPath)) {
  write("og-image.png", makeSocialCard(1200, 630));
  console.log("og-image.png generated (placeholder card)");
} else {
  console.log("og-image.png kept (existing file wins; pass --force to regenerate)");
}

console.log("icons written to public/:");
for (const line of written) console.log("  " + line);
