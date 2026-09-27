#!/usr/bin/env node
/**
 * Self-hosts the MediaPipe Pose runtime that powers the webcam 体感 mode.
 *
 *   node scripts/vendor-mediapipe.mjs           # lite + full models (~24 MB)
 *   node scripts/vendor-mediapipe.mjs --lite     # lite model only (~18 MB)
 *   node scripts/vendor-mediapipe.mjs --all      # every model (~50 MB)
 *
 * Files land in vendor/mediapipe/<version>/ and are picked up automatically by
 * scripts/build.mjs. The game prefers this local copy and falls back to
 * cdn.jsdelivr.net when it is absent, so this step is optional.
 *
 * The tarball is fetched and unpacked with Node built-ins only.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import https from "node:https";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = fs.existsSync(path.join(root, "site.config.json"))
  ? JSON.parse(fs.readFileSync(path.join(root, "site.config.json"), "utf8"))
  : {};
const VERSION = config.mediapipeVersion || "0.5.1675469404";

const REGISTRIES = [
  `https://registry.npmmirror.com/@mediapipe/pose/-/pose-${VERSION}.tgz`,
  `https://registry.npmjs.org/@mediapipe/pose/-/pose-${VERSION}.tgz`,
];

const mode = process.argv.includes("--all")
  ? "all"
  : process.argv.includes("--lite")
    ? "lite"
    : "default";

// pose.js resolves these through locateFile(); any missing file is a hard
// failure for 体感 mode, so the loader/wasm set is always included.
const ALWAYS = [
  "pose.js",
  "pose_solution_packed_assets_loader.js",
  "pose_solution_packed_assets.data",
  "pose_solution_simd_wasm_bin.js",
  "pose_solution_simd_wasm_bin.wasm",
  "pose_solution_simd_wasm_bin.data",
  "pose_solution_wasm_bin.js",
  "pose_solution_wasm_bin.wasm",
  "pose_web.binarypb",
  "pose_landmark_lite.tflite",
];
const optional = {
  lite: [],
  default: ["pose_landmark_full.tflite"],
  all: ["pose_landmark_full.tflite", "pose_landmark_heavy.tflite"],
};
const WANTED = new Set([...ALWAYS, ...optional[mode], "package.json"]);

function download(url, redirects = 5) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "user-agent": "nailong-build" } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          if (redirects <= 0) return reject(new Error("too many redirects"));
          return resolve(download(new URL(res.headers.location, url).href, redirects - 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      })
      .on("error", reject);
  });
}

function readString(buffer, offset, length) {
  return buffer
    .toString("latin1", offset, offset + length)
    .replace(/\0.*$/s, "")
    .trim();
}

/** Minimal ustar reader — npm tarballs never use exotic tar features. */
function untar(buffer) {
  const files = [];
  let offset = 0;
  let longName = null;
  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const rawName = readString(header, 0, 100);
    const size = parseInt(readString(header, 124, 12), 8) || 0;
    const type = String.fromCharCode(header[156] || 48);
    const prefix = readString(header, 345, 155);
    offset += 512;
    if (type === "L") {
      longName = buffer
        .toString("utf8", offset, offset + size)
        .replace(/\0+$/, "");
      offset += Math.ceil(size / 512) * 512;
      continue;
    }
    let name = prefix ? `${prefix}/${rawName}` : rawName;
    if (longName) {
      name = longName;
      longName = null;
    }
    if (type === "0" || type === "\0" || type === "") {
      files.push({ name, data: buffer.subarray(offset, offset + size) });
    }
    offset += Math.ceil(size / 512) * 512;
  }
  return files;
}

const target = path.join(root, "vendor", "mediapipe", VERSION);

async function main() {
  let tarball = null;
  let lastError = null;
  for (const url of REGISTRIES) {
    try {
      process.stdout.write(`downloading ${url}\n`);
      tarball = await download(url);
      break;
    } catch (error) {
      lastError = error;
      process.stdout.write(`  failed: ${error.message}\n`);
    }
  }
  if (!tarball) throw lastError || new Error("no registry reachable");

  const files = untar(zlib.gunzipSync(tarball));
  const byBase = new Map();
  for (const file of files) {
    const base = file.name.split("/").pop();
    if (!base) continue;
    byBase.set(base, file.data);
  }

  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });

  let total = 0;
  const missing = [];
  for (const name of WANTED) {
    const data = byBase.get(name);
    if (!data) {
      if (ALWAYS.includes(name)) missing.push(name);
      continue;
    }
    fs.writeFileSync(path.join(target, name), data);
    total += data.length;
  }

  // Rewrite package.json down to the licence-relevant fields.
  const pkgRaw = byBase.get("package.json");
  if (pkgRaw) {
    const pkg = JSON.parse(pkgRaw.toString("utf8"));
    fs.writeFileSync(
      path.join(target, "package.json"),
      JSON.stringify(
        {
          name: pkg.name,
          version: pkg.version,
          license: pkg.license,
          homepage: pkg.homepage,
          description: pkg.description,
        },
        null,
        2,
      ) + "\n",
    );
  }

  console.log("");
  console.log(`MediaPipe Pose ${VERSION} → vendor/mediapipe/${VERSION}`);
  console.log(`  mode: ${mode}`);
  console.log(`  files: ${fs.readdirSync(target).length}, ${(total / 1048576).toFixed(1)} MB`);
  if (missing.length) {
    console.log(`  ⚠ missing expected files: ${missing.join(", ")}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`vendor:mediapipe failed — ${error.message}`);
  process.exitCode = 1;
});
