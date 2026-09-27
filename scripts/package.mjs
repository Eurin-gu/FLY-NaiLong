#!/usr/bin/env node
/**
 * Packages dist/ into a single zip for a Netlify drag-and-drop deploy.
 *
 *   node scripts/package.mjs
 *
 * Before zipping it verifies that every asset index.html references actually
 * exists. That is precisely the failure mode that shipped a broken site: an
 * index.html pointing at vendor/three.min.js while dist/ only had hashed
 * assets, so the 3D engine silently failed to load.
 *
 * Zero dependencies: the zip is written with a small deflate-based writer.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const outFile = path.join(root, "nailong-site.zip");

if (!fs.existsSync(path.join(dist, "index.html"))) {
  console.error("✗ dist/index.html is missing. Run: npm run build");
  process.exit(1);
}

/* ------------------------------------------------------- integrity guard */

const html = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((m) => m[1])
  .filter((r) => !/^(https?:|data:|mailto:|#)/.test(r));

const missing = [];
const suspicious = [];
for (const ref of new Set(refs)) {
  const clean = ref.replace(/^[./]+/, "");
  if (!fs.existsSync(path.join(dist, clean))) missing.push(ref);
}
// The exact shape of the broken deploy: un-hashed first-party bundles.
for (const ref of refs) {
  if (/^(game|flight-world|style)\.(js|css)$/.test(ref)) suspicious.push(ref);
  if (ref === "vendor/three.min.js") suspicious.push(ref);
}

if (missing.length) {
  console.error("✗ index.html references files that are not in dist/:");
  for (const m of missing) console.error("    " + m);
  console.error("  This build would show the '3D 引擎需要喘口气' fallback. Run: npm run build");
  process.exit(1);
}
if (suspicious.length) {
  console.error("✗ index.html looks un-built (references: " + suspicious.join(", ") + ")");
  console.error("  dist/index.html must point at content-hashed assets/. Run: npm run build");
  process.exit(1);
}

/* -------------------------------------------------------------- zip writer */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

const COMPRESSIBLE = new Set([
  ".html", ".css", ".js", ".mjs", ".json", ".webmanifest", ".txt", ".xml", ".svg",
]);

function dosTime(date) {
  const time =
    (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2));
  const day =
    ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function walk(dir, base = "") {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + "/" + entry.name : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full, rel));
    else files.push({ rel, full });
  }
  return files.sort((a, b) => a.rel.localeCompare(b.rel));
}

const files = walk(dist);
const localParts = [];
const centralParts = [];
let offset = 0;
let rawTotal = 0;
let zipTotal = 0;
let compressedCount = 0;

for (const file of files) {
  const data = fs.readFileSync(file.full);
  const ext = path.extname(file.rel).toLowerCase();
  const useDeflate = COMPRESSIBLE.has(ext) && data.length > 256;
  const stored = useDeflate ? zlib.deflateRawSync(data, { level: 9 }) : data;
  const method = useDeflate && stored.length < data.length ? 8 : 0;
  const payload = method === 8 ? stored : data;
  if (method === 8) compressedCount += 1;

  const name = Buffer.from(file.rel.split(path.sep).join("/"), "utf8");
  const crc = crc32(data);
  const { time, day } = dosTime(fs.statSync(file.full).mtime);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(time, 10);
  local.writeUInt16LE(day, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(name.length, 26);
  local.writeUInt16LE(0, 28);
  localParts.push(local, name, payload);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(time, 12);
  central.writeUInt16LE(day, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(payload.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(0, 42 - 4);
  central.writeUInt32LE(offset, 42);
  centralParts.push(central, name);

  offset += local.length + name.length + payload.length;
  rawTotal += data.length;
  zipTotal += payload.length;
}

const centralSize = centralParts.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

const zip = Buffer.concat([...localParts, ...centralParts, end]);
fs.writeFileSync(outFile, zip);

const sha = crypto.createHash("sha256").update(zip).digest("hex");
const version = JSON.parse(fs.readFileSync(path.join(dist, "version.json"), "utf8"));
const mb = (n) => (n / 1048576).toFixed(2) + " MB";

console.log("");
console.log("  packaged for Netlify drag-and-drop");
console.log("  " + "-".repeat(52));
console.log("  output:        " + path.relative(root, outFile));
console.log("  assets checked:" + ` ${new Set(refs).size} references, all present`);
console.log("  files:         " + files.length + ` (${compressedCount} deflated)`);
console.log("  size:          " + mb(zip.length) + "  (raw " + mb(rawTotal) + ")");
console.log("  asset version: " + version.assetVersion);
console.log("  sha256:        " + sha);
console.log("");
console.log("  Upload: Netlify → your site → Deploys → drag this zip onto the drop zone.");
console.log("");
