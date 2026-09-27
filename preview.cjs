// Local development server: node preview.cjs  →  http://127.0.0.1:4173
//
// Serves the *source* tree (unminified, no service worker) so edits show up on
// refresh. For the production build use: npm run build && npm start
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".binarypb": "application/octet-stream",
  ".tflite": "application/octet-stream",
};

http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Bad Request");
      return;
    }
    if (pathname.endsWith("/")) pathname += "index.html";

    const file = path.join(ROOT, path.normalize(pathname).replace(/^([/\\])+/, ""));
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.setHeader(
      "Content-Type",
      MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
    );
    // Never cache during development so refreshes always show the latest edit.
    res.setHeader("Cache-Control", "no-store");
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, HOST, () =>
    console.log(`Preview: http://${HOST}:${PORT}  (source tree, no build step)`),
  );
