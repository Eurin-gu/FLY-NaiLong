#!/usr/bin/env node
/**
 * Production static server for 奶龙 · 喷射起飞计划.
 *
 *   node server.mjs [--port 8080] [--host 0.0.0.0] [--dist dist]
 *
 * A dependency-free replacement for hosting the built dist/ directory. It
 * serves the same security and caching policy that the static-host config
 * files (`_headers`) declare, compresses text on the fly and supports
 * conditional requests.
 *
 * Hosts such as Netlify, Cloudflare Pages or GitHub Pages should serve dist/
 * directly and ignore this file; it is for VPS / container / LAN hosting.
 */
import http from "node:http";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { SECURITY_HEADERS, cacheControlFor } from "./scripts/security.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const DIST = path.resolve(here, arg("--dist", process.env.DIST || "dist"));
const PORT = Number(arg("--port", process.env.PORT || 8080));
const HOST = arg("--host", process.env.HOST || "0.0.0.0");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".binarypb": "application/octet-stream",
  ".tflite": "application/octet-stream",
  ".map": "application/json; charset=utf-8",
};
const COMPRESSIBLE = new Set([
  ".html", ".js", ".mjs", ".css", ".json", ".webmanifest", ".txt", ".xml", ".svg",
]);

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  console.error(`✗ ${DIST} does not contain a build. Run "npm run build" first.`);
  process.exit(1);
}

/** Compression results are memoised per file revision so each file is encoded once. */
const compressCache = new Map();
function compress(file, stat, buffer) {
  const key = `${file}:${stat.size}:${stat.mtimeMs}`;
  const hit = compressCache.get(key);
  if (hit) return hit;
  const entry = {
    br: zlib.brotliCompressSync(buffer, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: 5,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer.length,
      },
    }),
    gz: zlib.gzipSync(buffer, { level: 6 }),
  };
  if (compressCache.size > 64) compressCache.clear();
  compressCache.set(key, entry);
  return entry;
}

function etagFor(stat) {
  return `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
}

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  if (!body) return res.end();
  return res.end(body);
}

const started = Date.now();
let requests = 0;

const server = http.createServer(async (req, res) => {
  const began = process.hrtime.bigint();
  requests += 1;

  let status = 500;
  let bytes = 0;

  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      status = 405;
      send(res, 405, { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" }, "Method Not Allowed");
      return;
    }

    const url = new URL(req.url, "http://localhost");
    let pathname = decodeURIComponent(url.pathname);

    if (pathname === "/healthz") {
      const versionPath = path.join(DIST, "version.json");
      const version = fs.existsSync(versionPath)
        ? JSON.parse(await fsp.readFile(versionPath, "utf8"))
        : {};
      status = 200;
      const payload = JSON.stringify({
        status: "ok",
        uptimeSeconds: Math.round((Date.now() - started) / 1000),
        requests,
        assetVersion: version.assetVersion || null,
        builtAt: version.builtAt || null,
      });
      bytes = Buffer.byteLength(payload);
      send(res, 200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, payload);
      return;
    }

    if (pathname.endsWith("/")) pathname += "index.html";
    // Never expose build metadata or host config files.
    const basename = path.basename(pathname);
    if (basename.startsWith(".") || basename === "_headers" || basename === "_redirects") {
      pathname = "/__missing__";
    }
    if (pathname === "/favicon.ico") pathname = "/favicon-96.png";

    let file = path.join(DIST, path.normalize(pathname).replace(/^([/\\])+/, ""));
    if (!file.startsWith(DIST)) {
      status = 403;
      send(res, 403, { "Content-Type": "text/plain; charset=utf-8" }, "Forbidden");
      return;
    }

    let stat = null;
    try {
      stat = await fsp.stat(file);
      if (stat.isDirectory()) {
        file = path.join(file, "index.html");
        stat = await fsp.stat(file);
      }
    } catch {
      stat = null;
    }

    if (!stat || !stat.isFile()) {
      file = path.join(DIST, "404.html");
      try {
        stat = await fsp.stat(file);
      } catch {
        stat = null;
      }
      status = 404;
      if (!stat) {
        send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not Found");
        return;
      }
    } else {
      status = 200;
    }

    const ext = path.extname(file).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    const headers = {
      ...SECURITY_HEADERS,
      "Content-Type": type,
      "Cache-Control": status === 404 ? "no-cache" : cacheControlFor("/" + path.relative(DIST, file).split(path.sep).join("/")),
      ETag: etagFor(stat),
      "Last-Modified": stat.mtime.toUTCString(),
    };

    if (req.headers["if-none-match"] === headers.ETag) {
      status = 304;
      send(res, 304, headers);
      return;
    }

    const wantsBody = req.method !== "HEAD";

    if (COMPRESSIBLE.has(ext) && stat.size > 1024) {
      const accepted = String(req.headers["accept-encoding"] || "");
      if (/\bbr\b/.test(accepted)) {
        const body = compress(file, stat, await fsp.readFile(file)).br;
        headers["Content-Encoding"] = "br";
        headers.Vary = "Accept-Encoding";
        bytes = body.length;
        send(res, status, headers, wantsBody ? body : null);
        return;
      }
      if (/\bgzip\b/.test(accepted)) {
        const body = compress(file, stat, await fsp.readFile(file)).gz;
        headers["Content-Encoding"] = "gzip";
        headers.Vary = "Accept-Encoding";
        bytes = body.length;
        send(res, status, headers, wantsBody ? body : null);
        return;
      }
    }

    headers["Content-Length"] = String(stat.size);
    bytes = stat.size;
    res.writeHead(status, headers);
    if (!wantsBody) return res.end();
    fs.createReadStream(file)
      .on("error", () => res.destroy())
      .pipe(res);
  } catch (error) {
    if (!res.headersSent) {
      send(res, 500, { "Content-Type": "text/plain; charset=utf-8" }, "Internal Server Error");
    } else {
      res.destroy();
    }
    console.error("request failed", error);
  } finally {
    const ms = Number(process.hrtime.bigint() - began) / 1e6;
    if (req.url !== "/healthz") {
      console.log(
        `${new Date().toISOString()} ${req.method} ${req.url} ${status} ${bytes}B ${ms.toFixed(1)}ms`,
      );
    }
  }
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;

server.listen(PORT, HOST, () => {
  const nets = Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === "IPv4" && !n.internal)
    .map((n) => n.address);
  console.log(`奶龙 · 喷射起飞计划 — production server`);
  console.log(`  dist:     ${DIST}`);
  console.log(`  local:    http://127.0.0.1:${PORT}`);
  for (const address of nets) console.log(`  network:  http://${address}:${PORT}`);
  console.log(`  health:   http://127.0.0.1:${PORT}/healthz`);
});

function shutdown(signal) {
  console.log(`\n${signal} received — draining connections…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
