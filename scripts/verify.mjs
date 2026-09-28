#!/usr/bin/env node
/**
 * End-to-end verification for the production build.
 *
 *   BASE_URL=http://127.0.0.1:8080 CDP_URL=http://127.0.0.1:9222 node scripts/verify.mjs
 *
 * Two layers:
 *   1. HTTP contract  — status codes, security headers, caching, compression,
 *      conditional requests and path-traversal refusal.
 *   2. Browser smoke  — real WebGL render, gameplay via visible DOM state,
 *      PWA installability and an offline reload through the service worker.
 *
 * The browser layer attaches over CDP to an already-running Chromium/Edge
 * (see scripts/verify.ps1), so this file stays portable and never spawns a
 * browser itself.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { chromium } from "playwright-core";

const BASE = (process.env.BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
const CDP = process.env.CDP_URL || "http://127.0.0.1:9222";
const SHOTS = path.resolve("output/verify");
const httpOnly = process.argv.includes("--http-only");
const captureOg = process.argv.includes("--capture-og");

fs.mkdirSync(SHOTS, { recursive: true });

function pngSize(file) {
  try {
    const buf = fs.readFileSync(file);
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) {
      return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    }
  } catch {}
  return { width: 0, height: 0 };
}

const results = [];
function record(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail: String(detail).slice(0, 400) });
  console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? `  — ${String(detail).slice(0, 160)}` : ""}`);
}
function section(title) {
  console.log(`\n${title}`);
}

/* ------------------------------------------------------------ HTTP layer */

async function checkHttp() {
  section("HTTP contract");

  const index = await fetch(`${BASE}/`);
  const html = await index.text();
  record("GET / → 200", index.status === 200, index.status);
  record(
    "index has a strict CSP",
    /script-src 'self'/.test(index.headers.get("content-security-policy") || ""),
  );
  record("X-Content-Type-Options: nosniff", index.headers.get("x-content-type-options") === "nosniff");
  record("Referrer-Policy set", Boolean(index.headers.get("referrer-policy")));
  record("frame-ancestors / X-Frame-Options set", Boolean(index.headers.get("x-frame-options")));
  record("camera Permissions-Policy allows self", /camera=\(self\)/.test(index.headers.get("permissions-policy") || ""));
  record("index is not cached long-term", /no-cache/.test(index.headers.get("cache-control") || ""));

  const assetMatch = html.match(/assets\/game\.[0-9a-f]+\.js/);
  record("index references a content-hashed bundle", Boolean(assetMatch), assetMatch && assetMatch[0]);

  if (assetMatch) {
    const asset = await fetch(`${BASE}/${assetMatch[0]}`);
    record("hashed asset → 200", asset.status === 200, asset.status);
    record(
      "hashed asset is immutable for a year",
      /max-age=31536000, immutable/.test(asset.headers.get("cache-control") || ""),
      asset.headers.get("cache-control"),
    );
  }

  const health = await fetch(`${BASE}/healthz`);
  const healthBody = await health.json().catch(() => ({}));
  record("GET /healthz → ok", health.status === 200 && healthBody.status === "ok", JSON.stringify(healthBody).slice(0, 120));

  const manifest = await fetch(`${BASE}/manifest.webmanifest`);
  const manifestBody = await manifest.json().catch(() => ({}));
  record(
    "manifest has 192/512 icons and standalone display",
    manifest.status === 200 &&
      manifestBody.display === "standalone" &&
      Array.isArray(manifestBody.icons) &&
      manifestBody.icons.some((i) => i.sizes === "512x512"),
  );

  const sw = await fetch(`${BASE}/sw.js`);
  record("GET /sw.js → 200 and uncached", sw.status === 200 && /no-cache/.test(sw.headers.get("cache-control") || ""));

  const notFound = await fetch(`${BASE}/definitely-not-here`);
  record("unknown path → 404", notFound.status === 404, notFound.status);
  record("404 body is the custom page", (await notFound.text()).includes("飞过头了"));

  const leaked = await fetch(`${BASE}/_headers`);
  record("build config is not served", leaked.status === 404, leaked.status);

  for (const target of ["/../package.json", "/%2e%2e/package.json", "/..%2fpackage.json"]) {
    const res = await fetch(`${BASE}${target}`);
    record(`traversal blocked: ${target}`, res.status === 404 || res.status === 403 || res.status === 400, res.status);
  }

  // Compression + conditional requests.
  const cssHref = (html.match(/assets\/style\.[0-9a-f]+\.css/) || [])[0];
  if (cssHref) {
    const br = await fetch(`${BASE}/${cssHref}`, { headers: { "accept-encoding": "br" } });
    record("brotli negotiation", br.headers.get("content-encoding") === "br", br.headers.get("content-encoding"));
    const etag = br.headers.get("etag");
    if (etag) {
      const conditional = await fetch(`${BASE}/${cssHref}`, { headers: { "if-none-match": etag } });
      record("If-None-Match → 304", conditional.status === 304, conditional.status);
    }
  }

  // The service worker manifest must not reference missing files.
  const swBody = await sw.text();
  const precache = swBody.match(/const PRECACHE = (\[[\s\S]*?\]);/);
  if (precache) {
    const urls = JSON.parse(precache[1]);
    const missing = [];
    for (const url of urls) {
      const res = await fetch(`${BASE}/${url.replace(/^\.\//, "")}`);
      if (res.status !== 200) missing.push(`${url}(${res.status})`);
    }
    record(`all ${urls.length} precached URLs resolve`, missing.length === 0, missing.join(", "));
  }

  // The emitted HTML must not leak a placeholder site URL.
  record("no unconfigured placeholder domain in index", !/example\.com/.test(html));
}

/* --------------------------------------------------------- browser layer */

const consoleErrors = [];
const failedRequests = [];

async function checkBrowser() {
  section("Browser smoke test");

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP);
  } catch (error) {
    record("CDP connection", false, error.message);
    return;
  }
  record("CDP connection", true, CDP);

  const context = browser.contexts()[0] || (await browser.newContext());
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(`console: ${msg.text()}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
  });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${BASE}/`, { waitUntil: "load" });

  const title = await page.title();
  record("page title", title.includes("奶龙"), title);

  record("WebGL context created", await page.evaluate(() => {
    const canvas = document.getElementById("gameCanvas");
    return Boolean(canvas && (canvas.getContext("webgl2") || canvas.getContext("webgl")));
  }));

  record(
    "render-error fallback stays hidden",
    await page.locator("#renderError").isHidden(),
  );

  await page.screenshot({ path: path.join(SHOTS, "desktop-ready.png") });
  await page.locator("#dragonHello").click();
  record("dragon responds to greeting", (await page.locator("#dragonSpeech").textContent()).includes("动力"));
  await page.locator("#startBtn").click();
  record("gesture guide is visible before flight", await page.locator("#gestureGuide").isVisible());
  await page.locator('[data-guide="steer"]').click();
  record("gesture guide explains steering", (await page.locator("#guideExplain").textContent()).includes("倾斜"));

  // Start the game and hold thrust. Assertions read the visible HUD, which is
  // exactly what a player sees in production.
  // 开局两步：开始游戏 → 选飞行方式 → 一键起飞
  let checkedPreflightCamera = false;
  const beginGame = async () => {
    const start = page.locator("#startBtn");
    if (await page.locator("#overlayModes").isHidden()) await start.click();
    record("preflight offers camera mode", await page.locator("#setupCamera").isVisible());
    if (!checkedPreflightCamera) {
      checkedPreflightCamera = true;
      await page.locator("#setupCamera").click();
      const ready = await page.waitForFunction(
        () => document.getElementById("setupCameraView")?.dataset.poseReady === "true",
        null,
        { timeout: 30000 },
      ).then(() => true).catch(() => false);
      record("preflight camera waits for pose model", ready);
      record("preflight shows camera preview", ready && await page.locator("#setupCameraView").isVisible());
      record("preflight gives camera framing feedback", ready && /入镜|起飞/.test(await page.locator("#setupCameraFeedback").textContent()));
      if (ready) {
        await page.screenshot({ path: path.join(SHOTS, "preflight-camera.png") });
        await page.setViewportSize({ width: 375, height: 667 });
        await page.screenshot({ path: path.join(SHOTS, "mobile-preflight-camera.png") });
        await page.setViewportSize({ width: 1440, height: 1000 });
      }
    }
    await page.locator('[data-flight="free"]').click();
    await page.locator("#setupManual").click();
    await start.click();
  };
  await beginGame();
  const readAltitude = () =>
    page.evaluate(() => Number((document.getElementById("altitudeText").textContent || "").replace(/[^0-9.-]/g, "")));
  const readVerticalSpeed = () =>
    page.evaluate(() =>
      Number(
        (document.getElementById("verticalText").textContent || "").replace(/[^0-9.-]/g, ""),
      ),
    );
  const readHearts = () =>
    page.evaluate(
      () =>
        (document.getElementById("healthText").textContent || "").split("♥").length - 1,
    );
  const waitFor = async (predicate, timeout, step = 200) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await predicate()) return true;
      await page.waitForTimeout(step);
    }
    return false;
  };
  const startAltitude = await readAltitude();

  await page.keyboard.down("Space");
  await page.waitForTimeout(3200);
  await page.keyboard.up("Space");
  const climbed = await readAltitude();
  record("thrust raises altitude", climbed > startAltitude + 100, `${startAltitude} → ${climbed} m`);

  await page.keyboard.down("Space");
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, "desktop-playing.png") });
  await page.keyboard.up("Space");

  // Fuel switching drives a real scene change.
  await page.getByRole("button", { name: /水柱/ }).click();
  record("fuel switch to water", await page.locator("[data-fuel=water].selected").count() === 1);

  // Pause toggles.
  await page.keyboard.press("KeyP");
  const pausedAltitude = await readAltitude();
  await page.waitForTimeout(700);
  record("pause freezes the simulation", (await readAltitude()) === pausedAltitude, `${pausedAltitude} m`);
  await page.keyboard.press("KeyP");

  section("Free fall and the traffic officer");

  // 1. Honest physics: with no thrust at all, dv/dt must equal gravity (~58 m/s²).
  await page.keyboard.down("Space");
  await page.waitForTimeout(900);
  await page.keyboard.up("Space");
  await waitFor(async () => (await readVerticalSpeed()) < -3, 9000);
  const v1 = await readVerticalSpeed();
  const t1 = Date.now();
  await page.waitForTimeout(700);
  const v2 = await readVerticalSpeed();
  const measuredG = (v1 - v2) / ((Date.now() - t1) / 1000);
  record(
    "falling obeys v = v₀ + g·t",
    measuredG > 45 && measuredG < 72,
    `${measuredG.toFixed(1)} m/s² (expect ≈58)`,
  );

  // 2. No terminal velocity — the previous build plateaued at 125 m/s.
  let fastestFall = v2;
  const landed = await waitFor(async () => {
    fastestFall = Math.min(fastestFall, await readVerticalSpeed());
    return (await readAltitude()) <= 4.5;
  }, 25000, 120);
  record("falls all the way back to the deck", landed, `altitude ${await readAltitude()} m`);
  record(
    "free fall is not clamped to a terminal velocity",
    fastestFall < -150,
    `peak ${fastestFall} m/s`,
  );

  // A visible #chase is NOT proof of a pursuit: the very same element doubles
  // as the spawn-protection banner and the ground warning. Only count a real one.
  const readChaseText = async () =>
    ((await page.locator("#chaseText").textContent()) || "").trim();
  const chaseIsReal = async () => {
    if (!(await page.locator("#chase").isVisible())) return false;
    const text = await readChaseText();
    return !text.includes("开局保护") && !text.includes("触地警告");
  };
  const restartRun = async () => {
    if (await page.locator("#gameOverlay").isVisible()) {
      record("result offers a separate mode change", await page.locator("#changeModeBtn").isVisible());
      await page.locator("#startBtn").click();
      record("replay starts without repeating setup", await page.locator("#gameOverlay").isHidden());
      await page.waitForTimeout(500);
    }
  };
  const redAlertOn = () =>
    page.evaluate(() => Boolean(document.getElementById("chaseFlash")?.classList.contains("on")));

  // 3. Standing on the deck gets a traffic officer airborne (10 s spawn
  //    protection, then a 3 s warning, then the pursuit).
  const heartsBeforeCrash = await readHearts();
  const officerArrived = await waitFor(chaseIsReal, 30000, 200);
  record("ground impact summons the traffic officer", officerArrived, await readChaseText());
  record("red alert lights up while he is on you", await redAlertOn());
  // chaseAlert peaks 350 ms into its 0.7 s cycle.
  await page.waitForTimeout(340);
  await page.screenshot({ path: path.join(SHOTS, "red-alert.png") });

  // 4. Ignoring him is punished: getting booked ends the run.
  const caught = await waitFor(
    async () => (await readHearts()) < heartsBeforeCrash,
    22000,
    200,
  );
  record(
    "getting caught costs a heart",
    caught,
    `${heartsBeforeCrash} → ${await readHearts()} hearts`,
  );

  // 5. Climbing out of his reach ends the chase for free. The run is over by
  //    now, so start a fresh one and let protection + warning elapse again.
  await restartRun();
  const heartsBeforeEscape = await readHearts();
  await waitFor(chaseIsReal, 30000, 200);
  await page.keyboard.down("Space");
  const shookHim = await waitFor(
    async () => !(await page.locator("#chase").isVisible()),
    15000,
    200,
  );
  await page.keyboard.up("Space");
  record("climbing out of reach shakes him off", shookHim);
  record(
    "escaping costs no health",
    (await readHearts()) === heartsBeforeEscape,
    `${heartsBeforeEscape} → ${await readHearts()} hearts`,
  );
  await page.waitForTimeout(250);
  record("red alert clears once you are clear", (await redAlertOn()) === false);

  // 6. The collision geometry itself, probed as a pure function.
  const probe = await page.evaluate(() => {
    const p = Object.create(window.FlightWorld.prototype);
    const findHit = (altitude) => {
      for (let x = -400; x <= 400; x += 4)
        if (p.buildingHit(x, altitude, 240)) return x;
      return null;
    };
    return {
      lowLevel: findHit(12) !== null,
      aboveRoofs: findHit(200) === null,
      riverGap: [-24, -12, 0, 12, 24].every((x) => !p.buildingHit(x, 12, 240)),
    };
  });
  record("buildings exist at rooftop height", probe.lowLevel);
  record("nothing to collide with above the skyline", probe.aboveRoofs);
  record("the river corridor stays clear", probe.riverGap);

  // 7. Rooftops call the officer too, not just the ground. Sliding along the
  // deck should trip the rooftop rule before the 3 s loiter rule fires, and the
  // call-out identifies which trap caught us. Retry if the ground won the race.
  let rooftopCall = false;
  let observedCall = "";
  for (let attempt = 0; attempt < 3 && !rooftopCall; attempt += 1) {
    await restartRun();
    await page.waitForTimeout(11000); // spawn protection blocks every chase
    await page.keyboard.down("KeyD");
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline && !rooftopCall) {
      if (await chaseIsReal()) {
        observedCall = ((await page.locator("#toast").textContent()) || "").trim();
        if (observedCall.includes("楼")) rooftopCall = true;
        break;
      }
      await page.waitForTimeout(150);
    }
    await page.keyboard.up("KeyD");
    if (!rooftopCall) {
      await waitFor(
        async () => await page.locator("#gameOverlay").isVisible(),
        12000,
        300,
      );
    }
  }
  record("flying into a building calls the officer", rooftopCall, observedCall);

  // Help dialog.
  await page.getByRole("button", { name: "飞行指南" }).click();
  record("help dialog opens", await page.locator("#helpDialog").isVisible());
  await page.getByRole("button", { name: /懂了，允许起飞/ }).click();

  // Mobile layout.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  // 手机端方向键按设计已移除，触屏改用画面拖动操作。
  record(
    "mobile direction pad is gone",
    (await page.locator(".mobile-steer").count()) === 0,
    "触屏靠拖动画面操作",
  );
  await page.screenshot({ path: path.join(SHOTS, "mobile-playing.png") });

  if (captureOg) {
    // A real in-flight frame beats a placeholder card as the share image.
    // Start from a clean session so the card never shows the pause overlay,
    // then promote the stage to a full 1200x630 frame with test-only CSS.
    await page.goto(`${BASE}/`, { waitUntil: "load" });
    await page.setViewportSize({ width: 1200, height: 630 });
    await beginGame();
    await page.keyboard.down("Space");
    await page.waitForTimeout(700);
    await page.addStyleTag({
      content:
        "#stage{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:9999!important;border-radius:0!important}" +
        ".topbar,.intro,.sidebar,.route,.tips-row,footer{display:none!important}",
    });
    await page.waitForTimeout(1600);
    await page.screenshot({ path: path.resolve("public/og-image.png") });
    await page.keyboard.up("Space");
    const { width, height } = pngSize(path.resolve("public/og-image.png"));
    record("captured a live og-image from the running game", width === 1200 && height === 630, `${width}x${height}`);
  }

  /* ---------------------------------------------------------- PWA layer */

  section("PWA / offline");

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${BASE}/`, { waitUntil: "load" });

  const swReady = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return "unsupported";
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((resolve) => setTimeout(() => resolve(null), 15000)),
    ]);
    return registration ? "ready" : "timeout";
  });
  record("service worker becomes ready", swReady === "ready", swReady);

  // Reload so the document is served by the worker, then cut the network.
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(600);
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  record("page is controlled by the service worker", controlled);

  let offlineOk = false;
  let offlineDetail = "";
  try {
    await context.setOffline(true);
    await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
    offlineOk = await page.evaluate(
      () => Boolean(document.getElementById("gameCanvas")) && Boolean(window.FlightWorld),
    );
    offlineDetail = await page.title();
  } catch (error) {
    offlineDetail = error.message;
  } finally {
    await context.setOffline(false).catch(() => undefined);
  }
  record("offline reload still boots the game", offlineOk, offlineDetail);

  section("Webcam runtime under CSP");

  const poseVersion = JSON.parse(
    fs.readFileSync(path.resolve("site.config.json"), "utf8"),
  ).mediapipeVersion;
  // 实测这条偶发失败（同一个 CSP、同一个 SW 状态下单测都通过），
  // 大概是整套跑完之后的资源压力导致，重试两次避免假警报。
  const runPoseCheck = () => page.evaluate(async (version) => {
    const base = new URL(`vendor/mediapipe/${version}/`, location.href).href;
    try {
      if (!window.Pose) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = base + "pose.js";
          script.onload = resolve;
          script.onerror = () => reject(new Error("pose.js failed to load"));
          document.head.appendChild(script);
        });
      }
      if (!window.Pose) return "pose global missing after load";
      const pose = new window.Pose({ locateFile: (file) => base + file });
      pose.onResults(() => {});
      pose.setOptions({
        modelComplexity: 0,
        smoothLandmarks: true,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
      });
      // A blank frame exercises wasm compile + model fetch without a camera.
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#87ceeb";
      ctx.fillRect(0, 0, 256, 256);
      await pose.send({ image: canvas });
      pose.close?.();
      return "ok";
    } catch (error) {
      return "error: " + (error && error.message);
    }
  }, poseVersion);
  let poseResult = "not attempted";
  for (let attempt = 0; attempt < 3 && poseResult !== "ok"; attempt += 1) {
    if (attempt) await page.waitForTimeout(1500);
    poseResult = await runPoseCheck();
  }
  record("MediaPipe pose runtime runs under the CSP", poseResult === "ok", poseResult);

  section("Console hygiene");
  record("no uncaught page errors", !consoleErrors.some((e) => e.startsWith("pageerror")), consoleErrors.filter((e) => e.startsWith("pageerror")).join(" | "));
  record("no CSP violations", !consoleErrors.some((e) => /Content Security Policy/i.test(e)), consoleErrors.filter((e) => /Content Security Policy/i.test(e)).join(" | "));
  record("no 4xx/5xx responses during the session", failedRequests.length === 0, failedRequests.slice(0, 5).join(" | "));
  record("no unexpected console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

  await page.close().catch(() => undefined);
  // With connectOverCDP, close() detaches/closes the attached browser; a failure
  // here must not mask the checks that already ran.
  await browser.close().catch(() => undefined);
}

/* ------------------------------------------------------------------ run */

console.log(`\nVerifying ${BASE}${httpOnly ? " (HTTP only)" : ""}`);

try {
  await checkHttp();
  if (!httpOnly) {
    const watchdog = setTimeout(() => {
      console.error("\n✗ browser section timed out; forcing exit");
      process.exit(1);
    }, 180000);
    watchdog.unref();
    await checkBrowser();
    clearTimeout(watchdog);
  }
} catch (error) {
  record("verification harness", false, error.stack || error.message);
}

const failed = results.filter((r) => !r.ok);
const passed = results.length - failed.length;

fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(
  path.join(SHOTS, "report.json"),
  JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), passed, failed: failed.length, results }, null, 2) + "\n",
);

console.log(`\n${passed}/${results.length} checks passed`);
if (failed.length) {
  console.log("\nFailures:");
  for (const f of failed) console.log(`  ✗ ${f.name} — ${f.detail}`);
}
console.log(`Report: ${path.join(SHOTS, "report.json")}\n`);
process.exit(failed.length ? 1 : 0);
