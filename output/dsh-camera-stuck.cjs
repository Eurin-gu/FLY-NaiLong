/* Repro: on the "今天怎么飞？" screen, choosing 摄像头体感 must not freeze the UI.
   Two cases: a camera that answers fast, and one whose permission prompt never answers. */
const { chromium } = require("playwright-core");
const BASE = process.env.BASE || "http://127.0.0.1:4173";
const SHOTS = "output/inspect";
const fs = require("fs");
fs.mkdirSync(SHOTS, { recursive: true });

const PROBE = `(() => {
  const ids = ["setupManual", "setupCamera", "startBtn", "setupBack", "free", "challenge"];
  const out = { scrim: null, loader: null, buttons: {}, topAtFlyBtn: null };
  const scrim = document.getElementById("poseScrim");
  const loader = document.getElementById("poseLoader");
  const info = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const hidden = el.hidden || cs.display === "none" || cs.visibility === "hidden";
    return {
      hidden,
      size: [Math.round(r.width), Math.round(r.height)],
      pointer: cs.pointerEvents,
      z: cs.zIndex,
      pos: cs.position,
    };
  };
  out.scrim = info(scrim);
  out.loader = info(loader);
  out.screen = document.body.dataset.screen;
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) { out.buttons[id] = "missing"; return; }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const visible = !el.hidden && cs.display !== "none" && cs.visibility !== "hidden" && r.width > 2;
    if (!visible) { out.buttons[id] = "hidden"; return; }
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    out.buttons[id] = {
      disabled: el.disabled === true,
      topmost: t ? (t.id || t.className.toString().slice(0, 20)) : "none",
      reachable: Boolean(t && (t === el || el.contains(t))),
    };
  });
  return out;
})()`;

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const ctx = browser.contexts()[0] || (await browser.newContext());
  const errors = [];

  const openSetup = async (tag) => {
    const p = await ctx.newPage();
    p.setDefaultTimeout(6000);
    p.on("pageerror", (e) => errors.push(tag + " pageerror: " + String(e.message).slice(0, 140)));
    p.on("console", (m) => { if (m.type() === "error") errors.push(tag + " console: " + m.text().slice(0, 140)); });
    await p.setViewportSize({ width: 1440, height: 1000 });
    await p.goto(BASE + "/", { waitUntil: "load" });
    await p.waitForTimeout(1200);
    await p.locator("#modePickBtn").click();
    await p.waitForTimeout(600);
    return p;
  };

  /* ---- case 1: permission prompt that never answers ---- */
  console.log("=== case 1: getUserMedia never resolves ===");
  const a = await openSetup("A");
  await a.evaluate(() => { navigator.mediaDevices.getUserMedia = () => new Promise(() => {}); });
  console.log("before click:", JSON.stringify(await a.evaluate(PROBE)));
  await a.locator("#setupCamera").click({ timeout: 4000 }).catch((e) => console.log("setupCamera click err:", e.message.slice(0, 80)));
  for (let i = 1; i <= 6; i++) {
    await a.waitForTimeout(i === 1 ? 1200 : 2400);
    const s = await a.evaluate(PROBE);
    console.log(`t≈${(i * 2.4).toFixed(1)}s scrim=${JSON.stringify(s.scrim)} loader=${s.loader && !s.loader.hidden}`);
    console.log("   buttons:", JSON.stringify(s.buttons));
  }
  await a.screenshot({ path: SHOTS + "/stuck-camera.png" });
  // the loader card must offer an explicit way out
  const cancelReachable = await a.evaluate(() => {
    const el = document.getElementById("poseLoaderCancel");
    if (!el) return "missing";
    const r = el.getBoundingClientRect();
    if (r.width < 2) return "hidden";
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return t === el ? "reachable" : "blocked by " + (t ? t.id || t.className : "none");
  });
  console.log("cancel button:", cancelReachable);
  const canceled = await a.locator("#poseLoaderCancel").click({ timeout: 5000 })
    .then(() => "clicked", (e) => "TIMEOUT " + e.message.slice(0, 60));
  console.log("click 取消 →", canceled);
  await a.waitForTimeout(900);
  const afterCancel = await a.evaluate(PROBE);
  console.log("after cancel: scrim hidden =", afterCancel.scrim && afterCancel.scrim.hidden,
    "| loader hidden =", afterCancel.loader && afterCancel.loader.hidden);
  console.log("   buttons:", JSON.stringify(afterCancel.buttons));
  console.log("   manual pressed:", await a.evaluate(() => document.getElementById("setupManual").getAttribute("aria-pressed")));

  // can the player still get out by picking 键盘 / 触屏?
  const manualReachable = await a.evaluate(() => {
    const el = document.getElementById("setupManual");
    const r = el.getBoundingClientRect();
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return t ? (t.id || t.className.toString().slice(0, 20)) : "none";
  });
  console.log("element at 键盘/触屏 center:", manualReachable);
  const esc = await a.locator("#setupManual").click({ timeout: 5000 }).then(() => "clicked", (e) => "TIMEOUT " + e.message.slice(0, 60));
  console.log("click 键盘/触屏 →", esc);
  await a.waitForTimeout(600);
  // and the run must still be startable
  await a.locator('[data-flight="free"]').click({ timeout: 4000 }).catch((e) => console.log("mode click err", e.message.slice(0, 50)));
  const started = await a.locator("#startBtn").click({ timeout: 4000 }).then(() => "clicked", (e) => "TIMEOUT " + e.message.slice(0, 50));
  await a.waitForTimeout(1200);
  console.log("pick free + 开始飞行 →", started,
    "| screen =", await a.evaluate(() => document.body.dataset.screen),
    "| overlay hidden =", await a.evaluate(() => document.getElementById("gameOverlay").hidden));
  await a.screenshot({ path: SHOTS + "/after-cancel.png" });
  await a.close();

  /* ---- case 2: a camera that answers ---- */
  console.log("");
  console.log("=== case 2: fake camera (answers immediately) ===");
  const b = await openSetup("B");
  await b.locator("#setupCamera").click({ timeout: 4000 }).catch((e) => console.log("click err", e.message.slice(0, 60)));
  for (let i = 1; i <= 5; i++) {
    await b.waitForTimeout(i === 1 ? 1500 : 3000);
    const s = await b.evaluate(PROBE);
    console.log(`t≈${(i * 3).toFixed(1)}s scrim=${s.scrim && !s.scrim.hidden} loader=${s.loader && !s.loader.hidden}`);
    console.log("   buttons:", JSON.stringify(s.buttons));
  }
  await b.screenshot({ path: SHOTS + "/setup-camera.png" });
  await b.close();

  console.log("");
  console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "errors: (none)");
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
