#!/usr/bin/env node
/**
 * Production build for 奶龙 · 喷射起飞计划.
 *
 *   node scripts/build.mjs [--deploy]
 *
 * What it does
 *  1. minifies every first-party script and stylesheet (falls back to a plain
 *     copy when the optional minifiers are not installed)
 *  2. content-hashes every asset so far-future immutable caching is safe
 *  3. rewrites index.html to reference the hashed assets and injects the
 *     SEO / social / PWA head tags
 *  4. emits a service worker with an exact precache manifest
 *  5. writes host config (_headers, _redirects) and ops metadata
 *
 * Zero runtime dependencies: only the optional devDependencies terser and
 * clean-css are used, and the build still succeeds without them.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { SECURITY_HEADERS } from "./security.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// DIST_DIR lets a verification run build somewhere other than the live dist/.
const dist = process.env.DIST_DIR
  ? path.resolve(root, process.env.DIST_DIR)
  : path.join(root, "dist");
const publicDir = path.join(root, "public");
const deploy = process.argv.includes("--deploy");

const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));
const hash = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 10);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/** Read width/height straight out of a PNG IHDR chunk. */
function pngSize(file) {
  try {
    const buf = fs.readFileSync(file);
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
  } catch {}
  return { width: 1200, height: 630 };
}

const warnings = [];
const log = (...a) => console.log(...a);

/* ------------------------------------------------------------------ config */

const site = exists("site.config.json")
  ? JSON.parse(read("site.config.json"))
  : {};

function resolveSiteUrl() {
  const explicit = process.env.SITE_URL || process.env.PUBLIC_URL || site.siteUrl;
  if (explicit) return explicit.replace(/\/+$/, "");
  // Common CI-provided origins.
  if (process.env.URL) return process.env.URL.replace(/\/+$/, "");            // Netlify
  if (process.env.DEPLOY_PRIME_URL) return process.env.DEPLOY_PRIME_URL.replace(/\/+$/, "");
  if (process.env.CF_PAGES_URL) return process.env.CF_PAGES_URL.replace(/\/+$/, ""); // Cloudflare Pages
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "";
}

const siteUrl = resolveSiteUrl();
if (!siteUrl) {
  warnings.push(
    "SITE_URL is not configured, so canonical/og:url/sitemap use relative paths. " +
      "Set \"siteUrl\" in site.config.json (or the SITE_URL env var) before a public launch.",
  );
}

const TITLE = site.name || "奶龙 · 喷射起飞计划";
const DESCRIPTION =
  site.description ||
  "奶龙的 3D 喷射飞行冒险：从城市冲进云层，便便、水柱和彩虹三种动力，今天飞高一点。";
const THEME_COLOR = site.themeColor || "#f6f5ef";

/* ------------------------------------------------------------- minifiers */

let minifyJs = null;
let minifyCss = null;
try {
  ({ minify: minifyJs } = await import("terser"));
} catch {
  warnings.push("terser is not installed; JavaScript is shipped unminified (run: npm install).");
}
try {
  const CleanCSS = (await import("clean-css")).default;
  const cleaner = new CleanCSS({ level: 2 });
  minifyCss = (code) => {
    const out = cleaner.minify(code);
    if (out.errors && out.errors.length) throw new Error(out.errors.join("; "));
    return out.styles;
  };
} catch {
  warnings.push("clean-css is not installed; CSS is shipped unminified (run: npm install).");
}

async function buildJs(code, label) {
  if (!minifyJs) return code;
  try {
    const out = await minifyJs(code, {
      compress: { passes: 2, drop_debugger: true },
      // Keep top-level names: flight-world.js and game.js share the global
      // FlightWorld binding across separate classic <script> tags.
      mangle: { toplevel: false },
      format: { comments: /@license|@preserve/i },
    });
    if (!out.code) throw new Error("empty output");
    return out.code;
  } catch (error) {
    warnings.push(`terser failed on ${label} (${error.message}); shipped unminified.`);
    return code;
  }
}

function buildCss(code, label) {
  if (!minifyCss) return code;
  try {
    return minifyCss(code);
  } catch (error) {
    warnings.push(`clean-css failed on ${label} (${error.message}); shipped unminified.`);
    return code;
  }
}

/* ------------------------------------------------------------ dist reset */

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "assets"), { recursive: true });
fs.mkdirSync(path.join(dist, "vendor"), { recursive: true });

const assets = {}; // logical name -> { url, bytes, raw }
function emit(name, ext, content, { minified = true } = {}) {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
  const h = hash(body);
  const file = `${name}.${h}${ext}`;
  fs.writeFileSync(path.join(dist, "assets", file), body);
  const url = `assets/${file}`;
  assets[name] = { url, bytes: body.length, minified };
  return url;
}

/* ---------------------------------------------------------------- assets */

const jsEntries = [
  ["flight-world", "flight-world.js"],
  ["game", "game.js"],
  ["boot", "boot.js"],
];
for (const [name, file] of jsEntries) {
  const out = await buildJs(read(file), file);
  emit(name, ".js", out);
}

emit("style", ".css", buildCss(read("style.css") + "\n" + read("experience.css"), "style.css + experience.css"));

// Three.js ships pre-minified; copy it verbatim so its MIT banner is preserved.
const three = fs.readFileSync(path.join(root, "vendor/three.min.js"));
emit("three", ".js", three, { minified: true });

/* --------------------------------------------------------- static files */

let copiedStatic = 0;
function copyInto(fromDir, toDir) {
  for (const entry of fs.readdirSync(fromDir, { withFileTypes: true })) {
    const src = path.join(fromDir, entry.name);
    const dest = path.join(toDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      copyInto(src, dest);
    } else {
      fs.copyFileSync(src, dest);
      copiedStatic += 1;
    }
  }
}
if (fs.existsSync(publicDir)) {
  fs.mkdirSync(dist, { recursive: true });
  copyInto(publicDir, dist);
}
if (exists("vendor/THREE-LICENSE.txt")) {
  fs.copyFileSync(
    path.join(root, "vendor/THREE-LICENSE.txt"),
    path.join(dist, "vendor/THREE-LICENSE.txt"),
  );
}

// Optional self-hosted MediaPipe pose bundle (npm run vendor:mediapipe).
const mediapipeSrc = path.join(root, "vendor", "mediapipe");
const mediapipeVersion = site.mediapipeVersion || "0.5.1675469404";
if (fs.existsSync(mediapipeSrc)) {
  copyInto(mediapipeSrc, path.join(dist, "vendor", "mediapipe"));
  log(`included self-hosted MediaPipe pose bundle (${copiedStatic} extra files).`);
} else {
  warnings.push(
    "vendor/mediapipe is missing, so webcam 体感 mode loads MediaPipe from cdn.jsdelivr.net at runtime. " +
      "Run \"npm run vendor:mediapipe\" to self-host it for reliable, offline-capable play.",
  );
}

/* ------------------------------------------------------------- manifest */

const manifest = {
  name: TITLE,
  short_name: site.shortName || "奶龙起飞",
  description: DESCRIPTION,
  lang: site.locale || "zh-CN",
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "any",
  background_color: "#bfe8fb",
  theme_color: THEME_COLOR,
  categories: ["games", "entertainment"],
  icons: [
    { src: "icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
};
fs.writeFileSync(
  path.join(dist, "manifest.webmanifest"),
  JSON.stringify(manifest, null, 2) + "\n",
);

/* ------------------------------------------------------------- index.html */

let html = read("index.html");

const replacements = [
  [`href="style.css"`, `href="${assets.style.url}"`],
  [`<link rel="stylesheet" href="experience.css" />`, ``],
  [`src="vendor/three.min.js"`, `src="${assets.three.url}"`],
  [`src="flight-world.js"`, `src="${assets["flight-world"].url}"`],
  [`src="game.js"`, `src="${assets.game.url}"`],
  [`<script src="${assets.game.url}"></script>`,
   `<script src="${assets.game.url}"></script>\n    <script src="${assets.boot.url}" defer></script>`],
];
for (const [from, to] of replacements) {
  if (!html.includes(from)) warnings.push(`index.html: expected to find ${from}`);
  html = html.split(from).join(to);
}

const abs = (p) => (siteUrl ? `${siteUrl}/${p}` : p);
const ogImage = abs("og-image.png");
const ogSize = pngSize(path.join(publicDir, "og-image.png"));

const head = [
  `    <link rel="manifest" href="manifest.webmanifest" />`,
  `    <link rel="apple-touch-icon" href="apple-touch-icon.png" />`,
  `    <link rel="icon" type="image/png" sizes="96x96" href="favicon-96.png" />`,
  `    <link rel="icon" type="image/png" sizes="48x48" href="favicon-48.png" />`,
  `    <link rel="preload" as="style" href="${assets.style.url}" />`,
  `    <meta name="color-scheme" content="light" />`,
  `    <meta name="robots" content="index,follow,max-image-preview:large" />`,
  siteUrl ? `    <link rel="canonical" href="${siteUrl}/" />` : "",
  `    <meta property="og:type" content="website" />`,
  `    <meta property="og:site_name" content="${TITLE}" />`,
  `    <meta property="og:title" content="${TITLE}" />`,
  `    <meta property="og:description" content="${DESCRIPTION}" />`,
  `    <meta property="og:image" content="${ogImage}" />`,
  `    <meta property="og:image:width" content="${ogSize.width}" />`,
  `    <meta property="og:image:height" content="${ogSize.height}" />`,
  siteUrl ? `    <meta property="og:url" content="${siteUrl}/" />` : "",
  `    <meta property="og:locale" content="zh_CN" />`,
  `    <meta name="twitter:card" content="summary_large_image" />`,
  `    <meta name="twitter:title" content="${TITLE}" />`,
  `    <meta name="twitter:description" content="${DESCRIPTION}" />`,
  `    <meta name="twitter:image" content="${ogImage}" />`,
  `    <meta name="apple-mobile-web-app-capable" content="yes" />`,
  `    <meta name="apple-mobile-web-app-title" content="${manifest.short_name}" />`,
  `    <script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: TITLE,
    description: DESCRIPTION,
    inLanguage: "zh-CN",
    applicationCategory: "Game",
    operatingSystem: "Web browser",
    gamePlatform: "Web browser",
    playMode: "SinglePlayer",
    image: ogImage,
    ...(siteUrl ? { url: `${siteUrl}/` } : {}),
  })}</script>`,
]
  .filter(Boolean)
  .join("\n");

html = html.replace("  </head>", head + "\n  </head>");
fs.writeFileSync(path.join(dist, "index.html"), html);

/* -------------------------------------------------------- service worker */

const ASSET_VERSION = hash(
  Object.values(assets)
    .map((a) => a.url)
    .sort()
    .join("|") + (fs.existsSync(mediapipeSrc) ? "|mp" : ""),
);

const precache = [
  "./",
  "index.html",
  "manifest.webmanifest",
  ...Object.values(assets).map((a) => a.url),
  "icon-192.png",
  "icon-512.png",
  "favicon-96.png",
];

const sw = `/* Generated by scripts/build.mjs — do not edit. */
const VERSION = "v-${ASSET_VERSION}";
/* 体感模型（wasm + 模型 + 数据包，约 11.6MB）单独放一个固定名字的缓存里。
   它不随版本号变化，所以发版时不会被 activate 清掉 —— 否则手机端每发一次版
   就得重新下载 11.6MB，这就是"模型总是加载很久"的根因。 */
const MEDIA_CACHE = "mediapipe-v1";
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(VERSION);
      // Cache entries individually so one bad URL cannot abort the install.
      await Promise.all(
        PRECACHE.map((url) => cache.add(url).catch(() => undefined)),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== VERSION && k !== MEDIA_CACHE)
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin media alone

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(VERSION);
          cache.put("index.html", response.clone());
          return response;
        } catch {
          const cache = await caches.open(VERSION);
          return (await cache.match("index.html")) || (await cache.match("./")) || Response.error();
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      // 体感模型走独立的长驻缓存，其余资源走随版本变化的缓存
      // 必须用 includes 而不是 startsWith：站点可能部署在子路径下
      // （GitHub Pages 就是 /FLY-NaiLong/），当成根路径判断的话这条路由永远不命中，
      // 11.6MB 的模型会被塞进随版本号变化的缓存里，每次发版都要重下。
      const isMedia = url.pathname.includes("/vendor/mediapipe/");
      const cache = await caches.open(isMedia ? MEDIA_CACHE : VERSION);
      const cached = await cache.match(request, { ignoreSearch: true });
      if (cached) return cached;
      try {
        const response = await fetch(request);
        if (response && response.status === 200 && response.type === "basic") {
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        return Response.error();
      }
    })(),
  );
});
`;
fs.writeFileSync(path.join(dist, "sw.js"), sw);

/* ------------------------------------------------------------ host files */

const headerLines = Object.entries(SECURITY_HEADERS)
  .map(([key, value]) => `  ${key}: ${value}`)
  .join("\n");

const headers = `# Generated by scripts/build.mjs — Netlify and Cloudflare Pages read this file.
/*
${headerLines}

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/vendor/mediapipe/*
  Cache-Control: public, max-age=31536000, immutable

/*.png
  Cache-Control: public, max-age=604800

/index.html
  Cache-Control: no-cache

/
  Cache-Control: no-cache

/sw.js
  Cache-Control: no-cache

/manifest.webmanifest
  Cache-Control: public, max-age=3600
`;
fs.writeFileSync(path.join(dist, "_headers"), headers);

// No redirect rules on purpose: the site is a single entry point, and a
// /index.html -> / 301 would make the service worker's precache of
// "index.html" follow a redirect. The file is still emitted because some
// hosts expect it to exist.
fs.writeFileSync(
  path.join(dist, "_redirects"),
  "# Generated by scripts/build.mjs - no redirects required.\n",
);

// Prevent Jekyll from eating files on GitHub Pages.
fs.writeFileSync(path.join(dist, ".nojekyll"), "");

/* ---------------------------------------------------------- ops metadata */

const version = {
  name: TITLE,
  version: JSON.parse(read("package.json")).version,
  assetVersion: ASSET_VERSION,
  builtAt: new Date().toISOString(),
  siteUrl: siteUrl || null,
  assets: Object.fromEntries(Object.entries(assets).map(([k, v]) => [k, v.url])),
  node: process.version,
};
fs.writeFileSync(path.join(dist, "version.json"), JSON.stringify(version, null, 2) + "\n");

/* --------------------------------------------------------------- robots */

fs.writeFileSync(
  path.join(dist, "robots.txt"),
  `User-agent: *
Allow: /
${siteUrl ? `Sitemap: ${siteUrl}/sitemap.xml\n` : ""}`,
);
if (siteUrl) {
  fs.writeFileSync(
    path.join(dist, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${siteUrl}/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>
`,
  );
}

/* --------------------------------------------------------------- report */

function walk(dir, base = "") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, rel));
    else out.push({ rel, size: fs.statSync(full).size });
  }
  return out;
}

const files = walk(dist).sort((a, b) => b.size - a.size);
const total = files.reduce((n, f) => n + f.size, 0);

log("");
log(`  ${TITLE}`);
log(`  build → dist/  (${files.length} files, ${kb(total)})`);
log("  " + "-".repeat(56));
for (const f of files.slice(0, 14)) log(`  ${kb(f.size).padStart(9)}  ${f.rel}`);
if (files.length > 14) log(`  ... ${files.length - 14} more`);
log("  " + "-".repeat(56));
log(`  asset version: ${ASSET_VERSION}`);
log(`  site url:      ${siteUrl || "(not configured)"}`);

if (warnings.length) {
  log("");
  for (const w of warnings) log(`  ⚠  ${w}`);
}

if (deploy && !siteUrl) {
  log("");
  log("  ✗ --deploy requires a configured site URL.");
  process.exit(1);
}
log("");
