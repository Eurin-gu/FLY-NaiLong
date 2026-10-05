/* Same freeze check for the intro path (开启摄像头) and the mobile loader card. */
const { chromium } = require("playwright-core");
const BASE = process.env.BASE || "http://127.0.0.1:4173";
const SHOTS = "output/inspect";

const reach = (ids) => `(() => {
  const out = {};
  ${JSON.stringify(ids)}.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) { out[id] = "missing"; return; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (el.hidden || cs.display === "none" || r.width < 2) { out[id] = "hidden"; return; }
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out[id] = (t === el || el.contains(t)) ? "ok" : "blocked by " + (t ? (t.id || t.className.toString().slice(0, 16)) : "none");
  });
  return out;
})()`;

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const ctx = browser.contexts()[0] || (await browser.newContext());
  const errors = [];

  /* case 3: intro, camera that never answers */
  const p = await ctx.newPage();
  p.setDefaultTimeout(6000);
  p.on("pageerror", (e) => errors.push("pageerror: " + String(e.message).slice(0, 120)));
  p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 120)); });
  await p.setViewportSize({ width: 1440, height: 1000 });
  await p.goto(BASE + "/", { waitUntil: "load" });
  await p.waitForTimeout(1200);
  await p.evaluate(() => { navigator.mediaDevices.getUserMedia = () => new Promise(() => {}); });
  await p.locator("#startBtn").click({ timeout: 4000 }).catch((e) => console.log("intro start err", e.message.slice(0, 60)));
  await p.waitForTimeout(2500);
  console.log("intro while camera hangs:", JSON.stringify(await p.evaluate(reach(["manualStart", "modePickBtn", "dragonHello", "startBtn", "poseLoaderCancel"]))));
  await p.screenshot({ path: SHOTS + "/intro-camera-hang.png" });
  const escape = await p.locator("#manualStart").click({ timeout: 5000 }).then(() => "clicked", (e) => "TIMEOUT " + e.message.slice(0, 60));
  await p.waitForTimeout(1000);
  console.log("intro 跳过校准/触屏试玩 →", escape, "| mode =", await p.evaluate(() => document.body.dataset.screen));
  await p.close();

  /* case 4: mobile loader card with the cancel button */
  const m = await ctx.newPage();
  m.setDefaultTimeout(6000);
  m.on("pageerror", (e) => errors.push("mobile pageerror: " + String(e.message).slice(0, 120)));
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(BASE + "/", { waitUntil: "load" });
  await m.waitForTimeout(1200);
  await m.evaluate(() => { navigator.mediaDevices.getUserMedia = () => new Promise(() => {}); });
  await m.locator("#modePickBtn").click({ timeout: 5000 });
  await m.waitForTimeout(500);
  await m.locator("#setupCamera").click({ timeout: 5000 }).catch((e) => console.log("mobile setupCamera err", e.message.slice(0, 60)));
  await m.waitForTimeout(2500);
  const box = await m.evaluate(() => {
    const card = document.getElementById("poseLoader").getBoundingClientRect();
    const btn = document.getElementById("poseLoaderCancel").getBoundingClientRect();
    return {
      card: [Math.round(card.left), Math.round(card.top), Math.round(card.width), Math.round(card.height)],
      cancel: [Math.round(btn.left), Math.round(btn.top), Math.round(btn.width), Math.round(btn.height)],
      cancelInsideCard: btn.bottom <= card.bottom + 1 && btn.top >= card.top,
      onScreen: btn.left >= 0 && btn.right <= innerWidth && btn.bottom <= innerHeight,
      reach: (() => { const t = document.elementFromPoint(btn.left + btn.width / 2, btn.top + btn.height / 2); return t && t.id; })(),
      text: document.getElementById("poseLoaderCancel").textContent.trim(),
    };
  });
  console.log("mobile loader:", JSON.stringify(box));
  await m.screenshot({ path: SHOTS + "/mobile-loader.png" });
  await m.close();

  console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "errors: (none)");
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
