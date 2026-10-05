/* Verify the fixes: ↻ restart, calibration fallback, non-blocking replay. */
const { chromium } = require("playwright-core");
const BASE = process.env.BASE || "http://127.0.0.1:4173";
const SHOTS = "output/inspect";
const fs = require("fs");
fs.mkdirSync(SHOTS, { recursive: true });
const log = [];
const say = (...a) => { const s = a.join(" "); log.push(s); console.log(s); };
let fails = 0;
const check = (name, ok, detail = "") => { if (!ok) fails++; say(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

const STATE = `(() => {
  const q = (id) => document.getElementById(id);
  const n = window.__nailong ? window.__nailong() : null;
  return {
    screen: document.body.dataset.screen, mode: n ? n.mode : null,
    startText: q('startBtn') ? q('startBtn').textContent.trim().slice(0, 16) : null,
    startDisabled: q('startBtn') ? q('startBtn').disabled : null,
    title: q('overlayTitle') ? q('overlayTitle').textContent.trim().slice(0, 18) : null,
    desc: q('overlayDescription') ? q('overlayDescription').textContent.trim().slice(0, 40) : null,
    overlayHidden: q('gameOverlay').hidden, modesHidden: q('overlayModes').hidden,
    manual: q('manualStart') ? q('manualStart').textContent.trim().slice(0, 20) : null,
    alt: q('altitudeText').textContent.trim(), score: q('scoreText').textContent.trim(),
  };
})()`;

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const ctx = browser.contexts()[0] || (await browser.newContext());
  const errors = [];
  const newPage = async () => {
    const p = await ctx.newPage();
    p.setDefaultTimeout(8000);
    p.on("pageerror", (e) => errors.push("pageerror: " + String(e.message).slice(0, 140)));
    p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 140)); });
    p.on("response", (r) => { if (r.status() >= 400) errors.push("http " + r.status() + " " + r.url()); });
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.goto(BASE + "/", { waitUntil: "load" });
    await p.waitForTimeout(1200);
    return p;
  };

  /* ---- A. ↻ restart during flight ---- */
  say("=== A. restart button (↻) ===");
  const a = await newPage();
  await a.locator("#manualStart").click();
  await a.locator("#tutorialSkip").click({ timeout: 1500 }).catch(() => {});
  await a.keyboard.down("Space");
  await a.waitForTimeout(3000);
  await a.keyboard.up("Space");
  const before = await a.evaluate(STATE);
  say("before", JSON.stringify(before));
  await a.locator("#restartBtn").click({ timeout: 5000 }).catch((e) => say("restart click error " + e.message.slice(0, 80)));
  await a.waitForTimeout(900);
  const after = await a.evaluate(STATE);
  say("after ", JSON.stringify(after));
  check("↻ restarts the run", after.mode === "running" && after.overlayHidden === true, JSON.stringify(after));
  const num = (v) => parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  check("↻ resets the score/altitude", num(after.alt) < num(before.alt) && num(after.score) <= num(before.score), `${before.alt}/${before.score} → ${after.alt}/${after.score}`);
  await a.screenshot({ path: SHOTS + "/v-restart.png" });
  await a.close();

  /* ---- B. calibration fallback after 20 s without motion ---- */
  say("");
  say("=== B. camera calibration fallback ===");
  const b = await newPage();
  await b.locator("#startBtn").click(); // 开启摄像头 → calibration
  await b.waitForTimeout(3000);
  const mid = await b.evaluate(STATE);
  say("t=3s ", JSON.stringify(mid));
  check("calibration started", mid.screen === "calibration", JSON.stringify(mid));
  check("skip affordance is labelled", /跳过校准/.test(mid.manual || ""), String(mid.manual));
  await b.waitForTimeout(24500);
  const late = await b.evaluate(STATE);
  say("t=27s", JSON.stringify(late));
  check("falls back instead of waiting forever", late.screen === "setup" && late.modesHidden === false, JSON.stringify(late));
  check("fallback explains itself", /没识别到|键盘/.test((late.desc || "") + (late.title || "")), late.title + " / " + late.desc);
  await b.screenshot({ path: SHOTS + "/v-calibration-fallback.png" });
  // the fallback path must be usable: pick a mode then fly
  await b.locator("[data-flight='free']").click();
  await b.waitForTimeout(300);
  await b.locator("#startBtn").click();
  await b.waitForTimeout(1200);
  const flying = await b.evaluate(STATE);
  say("after picking a mode", JSON.stringify(flying));
  check("can still start after the fallback", flying.mode === "running" && flying.overlayHidden === true, JSON.stringify(flying));
  await b.close();

  /* ---- C. replay while getUserMedia hangs ---- */
  say("");
  say("=== C. replay with a hanging camera permission prompt ===");
  const c = await newPage();
  await c.locator("#manualStart").click();
  await c.locator("#tutorialSkip").click({ timeout: 1500 }).catch(() => {});
  await c.locator("#cameraBtn").click({ timeout: 6000 }).catch((e) => say("cameraBtn error " + e.message.slice(0, 80)));
  for (let i = 0; i < 40; i++) {
    const on = await c.evaluate(() => document.getElementById("modeText").textContent.trim());
    if (on.includes("体感")) break;
    await c.waitForTimeout(1000);
  }
  say("camera on:", await c.evaluate(() => document.getElementById("modeText").textContent.trim()));
  await c.evaluate(() => { navigator.mediaDevices.getUserMedia = () => new Promise(() => {}); });
  await c.evaluate(() => { window.__nailong().lose(); });
  await c.waitForTimeout(1200);
  say("result", JSON.stringify(await c.evaluate(STATE)));
  await c.locator("#startBtn").click({ timeout: 5000 }).catch((e) => say("replay click error " + e.message.slice(0, 90)));
  await c.waitForTimeout(2000);
  const replay = await c.evaluate(STATE);
  say("2s after replay", JSON.stringify(replay));
  check("replay starts immediately even with a hanging camera", replay.mode === "running" && replay.overlayHidden === true, JSON.stringify(replay));
  await c.keyboard.down("Space");
  await c.waitForTimeout(1500);
  await c.keyboard.up("Space");
  const climbed = await c.evaluate(STATE);
  say("climbing after replay", JSON.stringify(climbed));
  check("keyboard flight works after the replay", Number(climbed.alt.replace(/\D/g, "")) > 25, climbed.alt);
  await c.screenshot({ path: SHOTS + "/v-replay.png" });
  await c.close();

  say("");
  say(errors.length ? "ERRORS:\n" + errors.join("\n") : "errors: (none)");
  if (errors.length) fails++;
  say(fails ? `\n${fails} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  fs.writeFileSync(SHOTS + "/verify-fixes.txt", log.join("\n"));
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
