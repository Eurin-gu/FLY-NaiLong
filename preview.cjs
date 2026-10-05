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
  ".ogg": "audio/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
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

    const rel = path.normalize(pathname).replace(/^([/\\])+/, "");
    // public/ 里的东西（sfx、music、PWA 图标、loader 用的 nailong.png）在构建时
    // 会被拷进 dist/ 根目录；源码树上它们只存在于 public/ 下。这里做一次回退，
    // 否则本地开发时 /nailong.png、/sfx/*.ogg 全是 404，加载图和音效都看不到。
    const candidates = [path.join(ROOT, rel), path.join(ROOT, "public", rel)];
    const file = candidates.find(
      (candidate) =>
        candidate.startsWith(ROOT) &&
        fs.existsSync(candidate) &&
        fs.statSync(candidate).isFile(),
    );
    if (!file) {
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
