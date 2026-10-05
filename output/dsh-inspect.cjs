/* Ad-hoc UI inspection: finds buttons that cannot be pressed and traces the flow.
   Node side only talks to an already-running Edge over CDP (port 9333). */
const { chromium } = require("playwright-core");
const BASE = process.env.BASE || "http://127.0.0.1:4173";
const SHOTS = "output/inspect";
const fs = require("fs");
fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const say = (...a) => { const s = a.join(" "); log.push(s); console.log(s); };

const HIT = `(() => {
  const rows = [];
  const nodes = document.querySelectorAll('button, [data-flight], [data-fuel], [role="button"]');
  const vw = innerWidth, vh = innerHeight;
  nodes.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) return;
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const top = document.elementFromPoint(cx, cy);
    rows.push({
      id: el.id || el.dataset.flight || el.dataset.fuel || (el.className || '').toString().slice(0, 18),
      disabled: el.disabled === true,
      ok: Boolean(top && (top === el || el.contains(top))),
      blocker: top && !(top === el || el.contains(top)) ? ((top.id || '') + '.' + (top.className || '').toString().slice(0, 26)) : '',
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
    });
  });
  return rows;
})()`;

const STATE = `(() => {
  const q = (id) => document.getElementById(id);
  const n = window.__nailong ? window.__nailong() : null;
  return {
    screen: document.body.dataset.screen,
    cls: document.body.className,
    overlayHidden: q('gameOverlay') ? q('gameOverlay').hidden : null,
    modesHidden: q('overlayModes') ? q('overlayModes').hidden : null,
    startDisabled: q('startBtn') ? q('startBtn').disabled : null,
    changeModeHidden: q('changeModeBtn') ? q('changeModeBtn').hidden : null,
    changeModeDisabled: q('changeModeBtn') ? q('changeModeBtn').disabled : null,
    startText: q('startBtn') ? q('startBtn').textContent.trim().slice(0, 24) : null,
    title: q('overlayTitle') ? q('overlayTitle').textContent.trim().slice(0, 24) : null,
    alt: q('altitudeText') ? q('altitudeText').textContent.trim() : null,
    hp: q('healthText') ? q('healthText').textContent.trim() : null,
    mode: n ? n.mode : null,
    loading: q('poseLoader') && !q('poseLoader').hidden,
    loaderText: q('poseLoaderText') ? q('poseLoaderText').textContent.slice(0, 20) : null,
    camera: Boolean(n && n.mode),
  };
})()`;

(async () => {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const ctx = browser.contexts()[0] || (await browser.newContext());
  const page = await ctx.newPage();
  page.setDefaultTimeout(6000);
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e.message).slice(0, 160)));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); });
  page.on("response", (r) => { if (r.status() >= 400) errors.push("http " + r.status() + " " + r.url().slice(-60)); });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(BASE + "/", { waitUntil: "load" });
  await page.waitForTimeout(1500);

  say("=== A. home screen ===");
  say("state", JSON.stringify(await page.evaluate(STATE)));
  say("hit", JSON.stringify(await page.evaluate(HIT), null, 0));
  await page.screenshot({ path: SHOTS + "/a-home.png" });

  // dragon greeting
  await page.locator("#dragonHello").click({ timeout: 4000 }).then(() => say("dragonHello click OK"), (e) => say("dragonHello FAIL " + e.message.slice(0, 90)));

  say("=== B. camera start path (default primary button) ===");
  const t0 = Date.now();
  await page.locator("#startBtn").click({ timeout: 4000 }).catch((e) => say("startBtn click FAIL " + e.message.slice(0, 90)));
  for (const ms of [2000, 4000, 6000, 8000, 10000, 15000]) {
    await page.waitForTimeout(ms - (Date.now() - t0));
    const st = await page.evaluate(STATE);
    say(`t=${((Date.now() - t0) / 1000).toFixed(0)}s`, JSON.stringify(st));
  }
  await page.screenshot({ path: SHOTS + "/b-camera-start.png" });
  say("hit-after-camera", JSON.stringify(await page.evaluate(HIT)));

  say("=== C. escape via manual button ===");
  const manual = await page.locator("#manualStart").isVisible().catch(() => false);
  say("manualStart visible:", manual);
  if (manual) {
    await page.locator("#manualStart").click({ timeout: 4000 }).catch((e) => say("manualStart FAIL " + e.message.slice(0, 90)));
  } else {
    await page.keyboard.press("Escape");
  }
  await page.waitForTimeout(1200);
  say("state", JSON.stringify(await page.evaluate(STATE)));
  await page.screenshot({ path: SHOTS + "/c-manual-start.png" });

  say("=== D. fly ===");
  await page.keyboard.down("Space");
  await page.waitForTimeout(2500);
  say("while climbing", JSON.stringify(await page.evaluate(STATE)));
  await page.screenshot({ path: SHOTS + "/d-climb.png" });
  await page.waitForTimeout(2500);
  say("higher", JSON.stringify(await page.evaluate(STATE)));
  await page.screenshot({ path: SHOTS + "/d-climb2.png" });
  await page.keyboard.up("Space");

  say("=== E. hud buttons while playing ===");
  say("hit", JSON.stringify(await page.evaluate(HIT)));
  for (const id of ["helpBtn", "pauseBtn", "fullscreenBtn", "restartBtn", "flyBtn", "rollBtn"]) {
    const el = page.locator("#" + id);
    const vis = await el.isVisible().catch(() => false);
    if (!vis) { say(id, "hidden"); continue; }
    const box = await el.boundingBox();
    const r = box ? await page.evaluate(([x, y]) => { const t = document.elementFromPoint(x, y); return t ? (t.id || t.className) : "null"; }, [box.x + box.width / 2, box.y + box.height / 2]) : "nobox";
    say(id, "topmost=" + r, "disabled=" + (await el.isDisabled().catch(() => "?")));
  }

  say("=== F. help dialog ===");
  await page.locator("#helpBtn").click({ timeout: 4000 }).then(() => say("help opened"), (e) => say("help FAIL " + e.message.slice(0, 90)));
  await page.waitForTimeout(600);
  await page.screenshot({ path: SHOTS + "/f-help.png" });
  say("dialog open:", await page.evaluate(() => { const d = document.getElementById("helpDialog"); return d ? d.open : null; }));
  await page.locator("#closeHelp").click({ timeout: 4000 }).then(() => say("help closed"), (e) => say("closeHelp FAIL " + e.message.slice(0, 90)));

  say("=== G. pause / resume ===");
  await page.locator("#pauseBtn").click({ timeout: 4000 }).catch((e) => say("pause FAIL " + e.message.slice(0, 90)));
  await page.waitForTimeout(700);
  say("paused", JSON.stringify(await page.evaluate(STATE)));
  await page.locator("#startBtn").click({ timeout: 4000 }).catch((e) => say("resume FAIL " + e.message.slice(0, 90)));
  await page.waitForTimeout(700);
  say("resumed", JSON.stringify(await page.evaluate(STATE)));

  say("=== H. result screen ===");
  await page.evaluate(() => { const n = window.__nailong && window.__nailong(); if (n && n.lose) n.lose(); });
  await page.waitForTimeout(1500);
  say("after lose", JSON.stringify(await page.evaluate(STATE)));
  say("hit", JSON.stringify(await page.evaluate(HIT)));
  await page.screenshot({ path: SHOTS + "/h-result.png" });

  say("=== I. replay + change mode ===");
  await page.locator("#changeModeBtn").click({ timeout: 4000 }).catch((e) => say("changeMode FAIL " + e.message.slice(0, 90)));
  await page.waitForTimeout(900);
  say("mode step", JSON.stringify(await page.evaluate(STATE)));
  await page.screenshot({ path: SHOTS + "/i-modes.png" });
  say("hit", JSON.stringify(await page.evaluate(HIT)));

  say("=== J. mobile 390x844 ===");
  const m = await ctx.newPage();
  m.setDefaultTimeout(6000);
  m.on("pageerror", (e) => errors.push("mobile pageerror: " + String(e.message).slice(0, 160)));
  await m.setViewportSize({ width: 390, height: 844 });
  await m.goto(BASE + "/", { waitUntil: "load" });
  await m.waitForTimeout(1500);
  await m.screenshot({ path: SHOTS + "/j-mobile-home.png" });
  say("mobile hit", JSON.stringify(await m.evaluate(HIT)));
  await m.locator("#manualStart").click({ timeout: 4000 }).catch((e) => say("mobile manualStart FAIL " + e.message.slice(0, 90)));
  await m.waitForTimeout(1500);
  await m.screenshot({ path: SHOTS + "/j-mobile-playing.png" });
  say("mobile playing hit", JSON.stringify(await m.evaluate(HIT)));
  await m.locator("#pauseBtn").click({ timeout: 4000 }).catch((e) => say("mobile pause FAIL " + e.message.slice(0, 90)));
  await m.waitForTimeout(800);
  say("mobile paused hit", JSON.stringify(await m.evaluate(HIT)));
  await m.screenshot({ path: SHOTS + "/j-mobile-paused.png" });

  say("=== ERRORS ===");
  say(errors.length ? errors.join("\n") : "(none)");
  fs.writeFileSync(SHOTS + "/log.txt", log.join("\n"));
  await page.close();
  await m.close();
  // Detach only: the CDP browser stays up for the next inspection run.
  process.exit(0);
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
